import type http from "node:http";
import mqtt from "mqtt";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { isMockActive, verifyToken } from "../middleware/auth.middleware";
import {
	getTenantsForUser,
	isDeviceInTenant,
	resolveActiveTenant,
} from "../services/tenant.service";

/**
 * Topic allow-list (regex anchored to the device or broadcast subtree).
 *
 * A frontend-initiated subscription must match one of these BEFORE the
 * tenant check passes; this prevents the frontend from subscribing to
 * implementation-detail topics (relay/init/ack) inside its own tenant.
 */
const TOPIC_ALLOWLIST: RegExp[] = [
	/^tenants\/[a-z0-9-]{3,40}\/devices\/[a-z0-9-]{8,64}\/telemetry(\/.*)?$/,
	/^tenants\/[a-z0-9-]{3,40}\/devices\/[a-z0-9-]{8,64}\/status(\/.*)?$/,
	/^tenants\/[a-z0-9-]{3,40}\/devices\/[a-z0-9-]{8,64}\/up$/,
	// Customer-defined downstream topics: `down` itself or any sub-topic
	// (`down/<topic>`). Tenant + device stay anchored, so it remains
	// tenant-scoped.
	/^tenants\/[a-z0-9-]{3,40}\/devices\/[a-z0-9-]{8,64}\/down(\/.*)?$/,
	/^tenants\/[a-z0-9-]{3,40}\/devices\/[a-z0-9-]{8,64}\/mavlink\/(up|down)$/,
	/^tenants\/[a-z0-9-]{3,40}\/broadcast(\/.*)?$/,
	// Frontend bulk subscription to every device in its own tenant.
	/^tenants\/[a-z0-9-]{3,40}\/devices\/\+\/#$/,
];

// Slug extraction — accept wildcard segments after the slug so we can
// validate bulk subscriptions like `tenants/<slug>/devices/+/#`. The
// slug itself must always be a literal.
const TENANT_SLUG_RE = /^tenants\/([a-z0-9-]{3,40})(?:\/|$)/;
const TENANT_DEVICE_TOPIC_RE =
	/^tenants\/([a-z0-9-]{3,40})\/devices\/([a-z0-9-]{8,64})\//;

const SCOPE_VIOLATION = "TENANT_SCOPE_VIOLATION";

const parseTenantFromTopic = (topic: string): string | null => {
	const m = TENANT_SLUG_RE.exec(topic);
	return m ? m[1] : null;
};

const topicAllowed = (topic: string): boolean =>
	TOPIC_ALLOWLIST.some((re) => re.test(topic));

type SocketData = {
	userId: string;
	tenantSlug: string;
	tenantId: number;
};

const tenantRoom = (slug: string) => `tenant:${slug}`;

export const registerSocketRoutes = (
	server: ReturnType<typeof http.createServer>,
) => {
	const io = new SocketIOServer(server, { cors: { origin: "*" } });

	// --- Auth + tenant resolution on handshake ---
	io.use(async (socket, next) => {
		try {
			let userId: string;
			if (isMockActive) {
				const mockUserId = socket.handshake.auth?.mockUserId;
				if (!mockUserId)
					return next(new Error("Mock auth: mockUserId required"));
				userId = mockUserId;
			} else {
				const token = socket.handshake.auth?.token;
				if (!token) return next(new Error("Authentication required"));
				const verified = await verifyToken(token);
				if (!verified) return next(new Error("Invalid or expired token"));
				userId = verified;
			}

			try {
				const resolved = await resolveActiveTenant(userId);
				(socket.data as SocketData) = {
					userId,
					tenantSlug: resolved.slug,
					tenantId: resolved.id,
				};
				next();
			} catch (err) {
				if (isMockActive) {
					// Surface the underlying issue (zero tenants, too many, etc.)
					const tenants = await getTenantsForUser(userId);
					return next(
						new Error(
							`Mock user ${userId} has ${tenants.length} tenants — ` +
								`seed exactly one before connecting.`,
						),
					);
				}
				return next(err as Error);
			}
		} catch (err) {
			next(err as Error);
		}
	});

	// --- MQTT bridge config ---
	const MQTT_TOPIC_OUT = process.env.MQTT_TOPIC_OUT || "data-out";
	const MQTT_BROKER =
		process.env.MQTT_BROKER_URL
		|| `mqtt://${process.env.MQTT_HOST || "mqtt"}:${process.env.MQTT_PORT || "1883"}`;
	const DEACTIVATE_MQTT = process.env.DEACTIVATE_MQTT === "true";

	if (DEACTIVATE_MQTT) {
		console.log("[MQTT] MQTT is deactivated via environment variable.");
		return;
	}

	// The webserver uses the privileged internal plaintext listener (1883).
	// External devices must use 8883 (TLS + mutual auth); the broker
	// enforces tenant ACLs on that listener.
	const client = mqtt.connect(MQTT_BROKER);

	client.on("connect", () => {
		console.log(`[MQTT] Connected to broker: ${MQTT_BROKER}`);
		client.subscribe("tenants/+/devices/+/#", (err) => {
			if (err) console.error("[MQTT] subscribe(tenants/+) failed:", err);
		});
		client.subscribe("tenants/+/broadcast/#", (err) => {
			if (err) console.error("[MQTT] subscribe(broadcast) failed:", err);
		});
	});

	client.on("error", (error) => {
		console.error("[MQTT] Error:", error);
	});

	// --- Fan-out: route MQTT messages strictly to the tenant's room ---
	client.on("message", (topic, message) => {
		const tenantSlug = parseTenantFromTopic(topic);
		if (!tenantSlug) {
			// Defence in depth — broker should not deliver these.
			return;
		}
		let payload: unknown = null;
		const raw = message.toString();
		try {
			payload = raw ? JSON.parse(raw) : null;
		} catch {
			payload = raw;
		}
		io.to(tenantRoom(tenantSlug)).emit("mqtt-message", { topic, payload });
	});

	// --- Socket.IO events ---
	io.on("connection", (socket: Socket) => {
		const data = socket.data as SocketData;
		socket.join(tenantRoom(data.tenantSlug));
		socket.emit("session", {
			tenantSlug: data.tenantSlug,
			userId: data.userId,
		});

		const reject = (
			eventTopic: string,
			reason: string,
			disconnect = false,
		) => {
			socket.emit("subscription-error", {
				code: SCOPE_VIOLATION,
				topic: eventTopic,
				reason,
			});
			console.warn(
				`[Socket.IO] ${SCOPE_VIOLATION} user=${data.userId} ` +
					`tenant=${data.tenantSlug} topic=${eventTopic} reason=${reason}`,
			);
			if (disconnect) socket.disconnect(true);
		};

		socket.on("subscribe", async (req: { topic?: string } | undefined) => {
			const topic = req?.topic;
			if (!topic || typeof topic !== "string") {
				return reject(String(topic), "missing topic", true);
			}
			const tenantInTopic = parseTenantFromTopic(topic);
			if (tenantInTopic !== data.tenantSlug) {
				return reject(topic, "cross-tenant topic", true);
			}
			if (!topicAllowed(topic)) {
				return reject(topic, "topic not in allow-list");
			}
			const deviceMatch = TENANT_DEVICE_TOPIC_RE.exec(topic);
			if (deviceMatch) {
				const deviceId = deviceMatch[2];
				const ok = await isDeviceInTenant(deviceId, data.tenantId);
				if (!ok) return reject(topic, "device not in tenant");
			}
			socket.join(`topic:${topic}`);
			socket.emit("subscribed", { topic });
		});

		socket.on("unsubscribe", (req: { topic?: string } | undefined) => {
			const topic = req?.topic;
			if (typeof topic === "string") socket.leave(`topic:${topic}`);
		});

		socket.on(
			"publish",
			(
				req:
					| { topic?: string; payload?: unknown; reliable?: boolean }
					| undefined,
			) => {
				const topic = req?.topic;
				if (!topic || typeof topic !== "string") {
					return reject(String(topic), "missing topic", true);
				}
				const tenantInTopic = parseTenantFromTopic(topic);
				if (tenantInTopic !== data.tenantSlug) {
					return reject(topic, "cross-tenant publish", true);
				}
				if (!topicAllowed(topic)) {
					return reject(topic, "topic not in allow-list");
				}
				// The endpoint expects a FLAT envelope: `device`, `tenant_slug`
				// and the message fields (msg/encoding/messageType/...) at the
				// top level. Derive the device from the already-validated topic
				// (authoritative) and inject the tenant from the authenticated
				// session, then spread the frontend-supplied message fields.
				const deviceMatch = TENANT_DEVICE_TOPIC_RE.exec(topic);
				const deviceId = deviceMatch?.[2];
				if (!deviceId) {
					return reject(topic, "publish topic missing device segment");
				}
				const inner =
					req?.payload && typeof req.payload === "object"
						? (req.payload as Record<string, unknown>)
						: {};
				const qos = req?.reliable ? 2 : 0;
				const payload = JSON.stringify({
					...inner,
					device: deviceId,
					tenant_slug: data.tenantSlug,
					reliable: req?.reliable === true,
				});
				client.publish(MQTT_TOPIC_OUT, payload, { qos }, (err) => {
					if (err) console.error("[MQTT] publish failed:", err);
				});
			},
		);

		socket.on("disconnect", () => {
			console.log(
				`[Socket.IO] disconnect user=${data.userId} tenant=${data.tenantSlug}`,
			);
		});
	});
};

// Exposed for unit tests.
export const __testing = {
	parseTenantFromTopic,
	topicAllowed,
	TOPIC_ALLOWLIST,
};
