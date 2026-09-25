import express from "express";
import { db } from "../models";
import { authMiddleware } from "../middleware/auth.middleware";
import {
	tenantMiddleware,
	type TenantScopedRequest,
} from "../middleware/tenant.middleware";

const { Device } = db.models;

export const registerDeviceRoutes = (app: express.Express) => {
	const router = express.Router();
	router.use(authMiddleware);
	router.use(tenantMiddleware);

	// All devices in the caller's active tenant — strictly scoped.
	router.get("/", async (req, res) => {
		const tenantId = (req as TenantScopedRequest).tenantId;
		const rows = await Device.findAll({
			where: { tenantId, revokedAt: null },
			attributes: ["id", "deviceId", "tenantId", "certSerial", "createdAt"],
		});
		res.send(rows);
	});

	app.use("/api/devices", router);
};
