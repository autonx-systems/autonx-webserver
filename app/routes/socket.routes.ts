import type http from "node:http";
import mqtt from "mqtt";
import { Server as SocketIOServer } from "socket.io";

export const registerSocketRoutes = (
	server: ReturnType<typeof http.createServer>,
) => {
	const io = new SocketIOServer(server, {
		cors: {
			origin: "*",
		},
	});

	// --- MQTT Config ---
	const MQTT_TOPIC = process.env.MQTT_TOPIC || "incoming";
	const MQTT_TOPIC_OUT = process.env.MQTT_TOPIC_OUT || "data-out";
	const MQTT_BROKER = process.env.MQTT_BROKER_URL || `mqtt://${process.env.MQTT_HOST || "mqtt"}:${process.env.MQTT_PORT || "1883"}`;
	const DEACTIVATE_MQTT = process.env.DEACTIVATE_MQTT === "true";

	if (DEACTIVATE_MQTT) {
		console.log("[MQTT] MQTT is deactivated via environment variable.");
		return;
	}

	// --- MQTT Client Setup ---
	const client = mqtt.connect(MQTT_BROKER);

	client.on("connect", () => {
		console.log(`[MQTT] Connected to broker: ${MQTT_BROKER}`);

		// Subscribe to incoming topic
		client.subscribe(MQTT_TOPIC, (err) => {
			if (err) {
				console.error(`[MQTT] Failed to subscribe to "${MQTT_TOPIC}":`, err);
			} else {
				console.log(`[MQTT] Subscribed to topic: ${MQTT_TOPIC}`);
			}
		});
	});

	client.on("error", (error) => {
		console.error("[MQTT] Error:", error);
	});

	// --- Forward incoming MQTT messages to Socket.IO clients ---
	client.on("message", (_topic, message) => {
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
			io.emit("live-sensor-data", decodedValue);
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
				client.publish(MQTT_TOPIC_OUT, JSON.stringify(data));
				console.log(`[MQTT] Message published to "${MQTT_TOPIC_OUT}"`);
			} catch (err) {
				console.error("[MQTT] Failed to publish message:", err);
			}
		});

		socket.on("disconnect", () => {
			console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
		});
	});
};
