import type http from "node:http";
import fs from "node:fs";
import mqtt from "mqtt";
import { Server as SocketIOServer } from "socket.io";
import { isMockActive, verifyToken } from "../middleware/auth.middleware";

export const registerSocketRoutes = (
	server: ReturnType<typeof http.createServer>,
) => {
	const io = new SocketIOServer(server, {
		cors: {
			origin: "*",
		},
	});

	// --- Auth middleware for Socket.IO ---
	io.use(async (socket, next) => {
		// Mock mode: trust mockUserId from handshake auth
		if (isMockActive) {
			const mockUserId = socket.handshake.auth?.mockUserId;
			if (!mockUserId) {
				return next(new Error("Mock auth: mockUserId required"));
			}
			(socket.data as { userId: string }).userId = mockUserId;
			return next();
		}

		const token = socket.handshake.auth?.token;
		if (!token) {
			return next(new Error("Authentication required"));
		}
		const userId = await verifyToken(token);
		if (!userId) {
			return next(new Error("Invalid or expired token"));
		}
		(socket.data as { userId: string }).userId = userId;
		next();
	});

	// --- MQTT Config ---
	const MQTT_TOPIC_INCOMING = process.env.MQTT_TOPIC_PATTERN_INCOMING || "tenant/+/device/+/incoming";
	const MQTT_HOST = process.env.MQTT_HOST || "mqtt";
	const MQTT_PORT = process.env.MQTT_PORT || "8883";
	const MQTT_USE_TLS = (process.env.MQTT_USE_TLS || "true").toLowerCase() !== "false";
	const MQTT_CA_CERT = process.env.MQTT_CA_CERT || "/certs/ca.crt";
	const MQTT_CLIENT_CERT = process.env.MQTT_CLIENT_CERT || "/certs/client.crt";
	const MQTT_CLIENT_KEY = process.env.MQTT_CLIENT_KEY || "/certs/client.key";
	const DEACTIVATE_MQTT = process.env.DEACTIVATE_MQTT === "true";

	if (DEACTIVATE_MQTT) {
		console.log("[MQTT] MQTT is deactivated via environment variable.");
		return;
	}

	// --- MQTT Client Setup (TLS + mTLS) ---
	const mqttOptions: mqtt.IClientOptions = {
		host: MQTT_HOST,
		port: Number(MQTT_PORT),
		protocol: MQTT_USE_TLS ? "mqtts" : "mqtt",
	};

	if (MQTT_USE_TLS) {
		mqttOptions.ca = fs.readFileSync(MQTT_CA_CERT);
		mqttOptions.cert = fs.readFileSync(MQTT_CLIENT_CERT);
		mqttOptions.key = fs.readFileSync(MQTT_CLIENT_KEY);
		mqttOptions.rejectUnauthorized = true;
	}

	const client = mqtt.connect(mqttOptions);

	client.on("connect", () => {
		console.log(`[MQTT] Connected to broker: ${MQTT_HOST}:${MQTT_PORT} (TLS=${MQTT_USE_TLS})`);

		client.subscribe(MQTT_TOPIC_INCOMING, (err) => {
			if (err) {
				console.error(`[MQTT] Failed to subscribe to "${MQTT_TOPIC_INCOMING}":`, err);
			} else {
				console.log(`[MQTT] Subscribed to topic: ${MQTT_TOPIC_INCOMING}`);
			}
		});
	});

	client.on("error", (error) => {
		console.error("[MQTT] Error:", error);
	});

	// --- Forward incoming MQTT messages to Socket.IO clients ---
	// Topic format: tenant/{tenant_id}/device/{device_id}/incoming
	client.on("message", (topic, message) => {
		try {
			const rawValue = message.toString();
			if (!rawValue) return;

			let decodedValue: unknown;
			try {
				decodedValue = JSON.parse(rawValue);
			} catch (err) {
				console.error("[MQTT] JSON parse error:", err);
				return;
			}

			// Parse tenant_id and device_id from topic
			const parts = topic.split("/");
			const tenantId = parts[1];
			const deviceId = parts[3];

			io.emit("live-sensor-data", { tenantId, deviceId, ...(decodedValue as object) });
		} catch (err) {
			console.error("[MQTT] Error decoding or sending:", err);
		}
	});

	// --- Socket.IO Events ---
	io.on("connection", (socket) => {
		console.log(`[Socket.IO] Client connected: ${socket.id}`);

		socket.on("send-message", (data) => {
			console.log(`[Socket.IO] Received "send-message" from ${socket.id}:`, data);

			try {
				const tenantId = data?.tenantId;
				const deviceId = data?.device;
				if (!tenantId || !deviceId) {
					console.error("[MQTT] send-message missing tenantId or device");
					return;
				}
				const egressTopic = `tenant/${tenantId}/device/${deviceId}/egress`;
				const qos = data?.reliable ? 2 : 0;
				client.publish(egressTopic, JSON.stringify(data), { qos }, (err) => {
					if (err) {
						console.error("[MQTT] Failed to publish message:", err);
					} else {
						console.log(`[MQTT] Message published to "${egressTopic}" (QoS ${qos})`);
					}
				});
			} catch (err) {
				console.error("[MQTT] Failed to publish message:", err);
			}
		});

		socket.on("disconnect", () => {
			console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
		});
	});
};
