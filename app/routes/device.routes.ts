import type { Express, Request, Response } from "express";
import { Device } from "../models/device.model";
import {
	issueDeviceCert,
	appendAclEntry,
	removeAclEntry,
	generateDeviceId,
} from "../services/cert-service";

export const registerDeviceRoutes = (app: Express) => {
	// Create a new device and issue its client certificate
	app.post("/api/devices", async (req: Request, res: Response) => {
		try {
			const { name, tenantId } = req.body;

			if (!name || !tenantId) {
				res.status(400).json({ error: "name and tenantId are required" });
				return;
			}

			const deviceId = generateDeviceId();

			// Issue mTLS client certificate
			const certBundle = issueDeviceCert(tenantId, deviceId);

			// Add ACL entry for the device
			appendAclEntry(tenantId, deviceId);

			// Store in database
			const device = await Device.create({
				deviceId,
				tenantId,
				name,
			});

			res.status(201).json({
				id: device.id,
				deviceId: device.deviceId,
				tenantId: device.tenantId,
				name: device.name,
				certBundle,
			});
		} catch (error: any) {
			console.error("[Devices] Failed to create device:", error);
			res.status(500).json({ error: error.message || "Internal server error" });
		}
	});

	// List devices (optionally filtered by tenantId)
	app.get("/api/devices", async (req: Request, res: Response) => {
		try {
			const { tenantId } = req.query;
			const where: any = {};
			if (tenantId) {
				where.tenantId = tenantId;
			}

			const devices = await Device.findAll({
				where,
				attributes: ["id", "deviceId", "tenantId", "name", "createdAt", "revokedAt"],
				order: [["createdAt", "DESC"]],
			});

			res.json(devices);
		} catch (error: any) {
			console.error("[Devices] Failed to list devices:", error);
			res.status(500).json({ error: error.message || "Internal server error" });
		}
	});

	// Get a single device
	app.get("/api/devices/:id", async (req: Request, res: Response) => {
		try {
			const device = await Device.findByPk(req.params.id, {
				attributes: ["id", "deviceId", "tenantId", "name", "createdAt", "revokedAt"],
			});

			if (!device) {
				res.status(404).json({ error: "Device not found" });
				return;
			}

			res.json(device);
		} catch (error: any) {
			console.error("[Devices] Failed to get device:", error);
			res.status(500).json({ error: error.message || "Internal server error" });
		}
	});

	// Revoke a device (soft-delete + remove ACL)
	app.delete("/api/devices/:id", async (req: Request, res: Response) => {
		try {
			const device = await Device.findByPk(req.params.id);

			if (!device) {
				res.status(404).json({ error: "Device not found" });
				return;
			}

			// Remove ACL entry
			removeAclEntry(device.tenantId, device.deviceId);

			// Soft-revoke
			device.revokedAt = new Date();
			await device.save();

			res.json({ message: "Device revoked", deviceId: device.deviceId });
		} catch (error: any) {
			console.error("[Devices] Failed to revoke device:", error);
			res.status(500).json({ error: error.message || "Internal server error" });
		}
	});
};
