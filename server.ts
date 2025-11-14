import http from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { db } from "./app/models";
import { registerSocketRoutes } from "./app/routes/socket.routes";
import { registerViewRoutes } from "./app/routes/view.routes";

dotenv.config();

const app = express();
const server = http.createServer(app);

var corsOptions = {
	origin: "http://localhost:3000",
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

db.sequelize.sync().catch((error) => {
    console.log('Error syncing database:', error);
});

// drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

app.get("/", (_req, res) => {
	res.json({ message: "Welcome to AutonX webserver." });
});

registerViewRoutes(app);
registerSocketRoutes(server);

// --- Server Start ---
const HOST = process.env.NODE_DOCKER_HOST || "0.0.0.0";
const PORT = Number(process.env.NODE_DOCKER_PORT) || 8080;
server.listen(PORT, HOST, () => {
	console.log(`Server is running on ${HOST}:${PORT}.`);
});
