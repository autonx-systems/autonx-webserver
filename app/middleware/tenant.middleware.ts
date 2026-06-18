import type { NextFunction, Response } from "express";
import { resolveActiveTenant } from "../services/tenant.service";
import type { AuthenticatedRequest } from "./auth.middleware";

export type TenantScopedRequest = AuthenticatedRequest & {
	tenantId?: number;
	tenantSlug?: string;
};

/**
 * Attaches the caller's active tenant to the request.
 *
 * Must run AFTER `authMiddleware` (which sets `req.userId`).
 */
export const tenantMiddleware = async (
	req: TenantScopedRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	if (!req.userId) {
		res.status(401).json({ message: "Not authenticated" });
		return;
	}
	try {
		const tenant = await resolveActiveTenant(req.userId);
		req.tenantId = tenant.id;
		req.tenantSlug = tenant.slug;
		next();
	} catch (err) {
		const message = (err as Error).message;
		res.status(403).json({ message });
	}
};
