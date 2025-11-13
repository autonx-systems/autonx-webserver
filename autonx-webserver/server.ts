import http from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import Kafka from "node-rdkafka";
import { Server as SocketIOServer } from "socket.io";
import { db } from "./app/models";
import { registerViewRoutes } from "./app/routes/view.routes";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
	cors: {
		origin: "*",
	},
});

var corsOptions = {
	origin: "http://localhost:3000",
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

db.sequelize.sync();
// // drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

app.get("/", (_req, res) => {
	res.json({ message: "Welcome to AutonX webserver." });
});

registerViewRoutes(app);

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

const consumer = new Kafka.KafkaConsumer(
	{
		"group.id": KAFKA_GROUP_ID,
		"metadata.broker.list": KAFKA_BROKERS,
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

// --- Server Start ---
const HOST = process.env.NODE_DOCKER_HOST || "0.0.0.0";
const PORT = Number(process.env.NODE_DOCKER_PORT) || 8080;
server.listen(PORT, HOST, () => {
	console.log(`Server is running on ${HOST}:${PORT}.`);
});
