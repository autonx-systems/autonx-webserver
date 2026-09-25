import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
	tenantMiddleware,
	type TenantScopedRequest,
} from "../middleware/tenant.middleware";
import { getTenantsForUser } from "../services/tenant.service";

export const registerTenantRoutes = (app: express.Express) => {
	const router = express.Router();
	router.use(authMiddleware);

	// All tenants the current user belongs to (read-only, no admin UI).
	router.get("/me", async (req, res) => {
		const userId = (req as TenantScopedRequest).userId;
		if (!userId) {
			res.status(401).json({ message: "Not authenticated" });
			return;
		}
		const tenants = await getTenantsForUser(userId);
		res.json({ tenants });
	});

	// Active tenant (errors if user has 0 or >1 — same rule as resolveActiveTenant).
	router.get("/active", tenantMiddleware, (req, res) => {
		const r = req as TenantScopedRequest;
		res.json({ id: r.tenantId, slug: r.tenantSlug });
	});

	app.use("/api/tenants", router);
};
