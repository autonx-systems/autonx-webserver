import type http from "node:http";
import Kafka from "node-rdkafka";
import { Server as SocketIOServer } from "socket.io";

export const registerSocketRoutes = (
	server: ReturnType<typeof http.createServer>,
) => {
	const io = new SocketIOServer(server, {
		cors: {
			origin: "*",
		},
	});

	// --- Socket.IO Events ---
	io.on("connection", (socket) => {
		console.log(`[Socket.IO] Client connected: ${socket.id}`);
		socket.on("disconnect", () => {
			console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
		});
	});

	// --- Kafka Consumer Setup ---
	const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "incoming";
	const KAFKA_BROKERS = process.env.KAFKA_BOOTSTRAP_SERVERS || "kafka:9092";
	const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || "websocket-streamer";
	const DEACTIVATE_KAFKA = process.env.DEACTIVATE_KAFKA === "true";

	if (DEACTIVATE_KAFKA) {
		console.log("[Kafka] Kafka consumer is deactivated via environment variable.");
		return;
	}

	const consumer = new Kafka.KafkaConsumer(
		{
			"group.id": KAFKA_GROUP_ID,
			"metadata.broker.list": KAFKA_BROKERS,
			// "reconnect.backoff.ms": DEV ? 10000 : 50,
			// "retry.backoff.ms": DEV ? 10000 : 100,
			// "retry.backoff.max.ms": DEV ? 30000 : 1000,
		},
		{
			"auto.offset.reset": "earliest",
		},
	);

	consumer.connect();

	consumer
		.on("ready", () => {
			console.log(`[Kafka] Connected. Subscribing to topic: ${KAFKA_TOPIC}`);
			consumer.subscribe([KAFKA_TOPIC]);
			consumer.consume();
		})
		.on("data", (msg) => {
			try {
				const rawValue = msg.value?.toString();
				if (!rawValue) return;
				let decodedValue: unknown;
				try {
					decodedValue = JSON.parse(rawValue);
				} catch (err) {
					console.error("[Kafka] JSON parse error:", err);
					return;
				}
				// Sende an alle verbundenen Socket.IO-Clients
				io.emit("live-sensor-data", decodedValue);
			} catch (err) {
				console.error("[Kafka] Error decoding or sending:", err);
			}
		})
		.on("event.error", (error) => {
			console.error("[Kafka] Error:", error);
		});
};
