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

	// --- Kafka Config ---
	const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "incoming";
	const KAFKA_TOPIC_OUT = process.env.KAFKA_TOPIC_OUT || "data-out";
	const KAFKA_BROKERS = process.env.KAFKA_BOOTSTRAP_SERVERS || "kafka:9092";
	const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || "websocket-streamer";
	const DEACTIVATE_KAFKA = process.env.DEACTIVATE_KAFKA === "true";

	// --- Kafka Producer Setup ---
	let producer: Kafka.Producer | null = null;

	if (!DEACTIVATE_KAFKA) {
		producer = new Kafka.Producer({
			"metadata.broker.list": KAFKA_BROKERS,
		});

		producer.connect();

		producer
			.on("ready", () => {
				console.log(`[Kafka Producer] Ready. Will publish to topic: ${KAFKA_TOPIC_OUT}`);
			})
			.on("event.error", (error) => {
				console.error("[Kafka Producer] Error:", error);
			});
	}

	// --- Socket.IO Events ---
	io.on("connection", (socket) => {
		console.log(`[Socket.IO] Client connected: ${socket.id}`);

		socket.on("send-message", (data) => {
			console.log(`[Socket.IO] Received "send-message" from ${socket.id}:`, data);

			if (producer) {
				try {
					producer.produce(
						KAFKA_TOPIC_OUT,
						null,
						Buffer.from(JSON.stringify(data)),
						null,
						Date.now(),
					);
					console.log(`[Kafka Producer] Message sent to "${KAFKA_TOPIC_OUT}"`);
				} catch (err) {
					console.error("[Kafka Producer] Failed to send message:", err);
				}
			} else {
				console.warn("[Kafka Producer] Producer not available, message not sent.");
			}
		});

		socket.on("disconnect", () => {
			console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
		});
	});

	if (DEACTIVATE_KAFKA) {
		console.log("[Kafka] Kafka is deactivated via environment variable.");
		return;
	}

	// --- Kafka Consumer Setup ---
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
