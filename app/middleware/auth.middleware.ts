import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const HANKO_API_URL = process.env.HANKO_API_URL;
const AUTH_MOCK = process.env.AUTH_MOCK === "true";
const NODE_ENV = process.env.NODE_ENV || "development";

// Safety: never allow mock auth in production
const isMockActive = AUTH_MOCK && NODE_ENV !== "production";

if (isMockActive) {
	console.warn("[Auth] ⚠️  MOCK AUTH ACTIVE — all requests authenticated via X-Mock-User-Id header. Do NOT use in production.");
} else if (AUTH_MOCK && NODE_ENV === "production") {
	console.error("[Auth] 🚨 AUTH_MOCK=true is IGNORED because NODE_ENV=production. Refusing to enable mock auth.");
}

if (!isMockActive && !HANKO_API_URL) {
	console.warn("[Auth] HANKO_API_URL is not set — JWT verification will reject all requests.");
}

const JWKS = !isMockActive && HANKO_API_URL
	? createRemoteJWKSet(new URL(`${HANKO_API_URL}/.well-known/jwks.json`))
	: null;

export type AuthenticatedRequest = Request & {
	userId?: string;
};

export const authMiddleware = async (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	// Mock mode: trust X-Mock-User-Id header
	if (isMockActive) {
		const mockUserId = req.headers["x-mock-user-id"];
		if (!mockUserId || typeof mockUserId !== "string") {
			res.status(401).json({ message: "Mock auth: X-Mock-User-Id header required" });
			return;
		}
		req.userId = mockUserId;
		next();
		return;
	}

	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith("Bearer ")) {
		res.status(401).json({ message: "Missing or invalid Authorization header" });
		return;
	}

	const token = authHeader.slice(7);

	if (!JWKS) {
		res.status(500).json({ message: "Auth not configured (HANKO_API_URL missing)" });
		return;
	}

	try {
		const { payload } = await jwtVerify(token, JWKS);
		req.userId = payload.sub;
		next();
	} catch (err) {
		console.error("[Auth] JWT verification failed:", (err as Error).message);
		res.status(401).json({ message: "Invalid or expired token" });
	}
};

/**
 * Verify a JWT token string and return the user ID, or null if invalid.
 * Used for Socket.IO handshake authentication.
 */
export const verifyToken = async (token: string): Promise<string | null> => {
	if (!JWKS) return null;
	try {
		const { payload } = await jwtVerify(token, JWKS);
		return payload.sub ?? null;
	} catch {
		return null;
	}
};

/**
 * Whether mock auth is active (for socket.io middleware to check).
 */
export { isMockActive };
