import http from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { bootstrapDb, db } from "./app/models";
import { registerDeviceRoutes } from "./app/routes/device.routes";
import { registerSocketRoutes } from "./app/routes/socket.routes";
import { registerTenantRoutes } from "./app/routes/tenant.routes";
import { registerViewRoutes } from "./app/routes/view.routes";

dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOriginIp = process.env.CORS_ORIGIN_IP || "localhost";
const corsOriginHttp = `http://${corsOriginIp}`;
const corsOriginHttps = `https://${corsOriginIp}`;
const corsOriginLocalhost = `http://${corsOriginIp}:3000`;

var corsOptions = {
	origin: [corsOriginHttp, corsOriginHttps, corsOriginLocalhost],
};

if (corsOriginIp !== "localhost") {
  corsOptions.origin.push('http://localhost:3000');
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optional destructive reset for local dev. `bootstrapDb()` below then
// recreates everything additively.
if (process.env.FORCE_NEW_DB === "true") {
  db.sequelize
    .sync({ force: true })
    .then(() => console.log("Drop and re-sync db."))
    .catch((error) => console.error("Error force-resetting db:", error));
}

// Idempotent additive bootstrap for the multi-tenant tables (and the
// legacy `Views` table). This is the single source of truth for
// schema management — the previous unconditional `db.sequelize.sync()`
// raced with this and is intentionally removed.
bootstrapDb().catch((error) => {
  console.error("Error bootstrapping multi-tenant schema:", error);
});

app.get("/", (_req, res) => {
	res.json({ message: "Welcome to AutonX webserver." });
});

registerViewRoutes(app);
registerTenantRoutes(app);
registerDeviceRoutes(app);
registerSocketRoutes(server);

// --- Server Start ---
const HOST = process.env.NODE_DOCKER_HOST || "0.0.0.0";
const PORT = Number(process.env.NODE_DOCKER_PORT) || 8080;
server.listen(PORT, HOST, () => {
	console.log(`Server is running on ${HOST}:${PORT}.`);
});
