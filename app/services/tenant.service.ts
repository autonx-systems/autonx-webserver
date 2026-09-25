import { db } from "../models";

const { Tenant, UserTenant, Device } = db.models;

export type ResolvedTenant = {
	id: number;
	slug: string;
	name: string;
};

export const getTenantsForUser = async (
	userId: string,
): Promise<ResolvedTenant[]> => {
	const load = async (): Promise<ResolvedTenant[]> => {
		const rows = await UserTenant.findAll({
			where: { userId },
			include: [{ model: Tenant }],
		});
		return rows
			.map((row) => {
				const tenant = (row as unknown as { Tenant?: InstanceType<typeof Tenant> }).Tenant;
				if (!tenant) return null;
				return { id: tenant.id, slug: tenant.slug, name: tenant.name };
			})
			.filter((t): t is ResolvedTenant => t !== null);
	};
	let tenants = await load();
	if (tenants.length === 0) {
		const autoAttached = await maybeAutoAttachDevTenant(userId);
		if (autoAttached) tenants = [autoAttached];
	}
	return tenants;
};

/**
 * Resolve the single tenant a user belongs to.
 *
 * v1 has no tenant switcher, so users with zero or multiple tenants
 * cause an explicit error rather than a silent "pick the first" — see
 * plan "Further considerations" #3.
 *
 * Dev convenience: when `DEV_SEED_TENANT_SLUG` is set and we're not in
 * production, a brand-new user with 0 memberships is auto-attached to
 * that tenant (handled inside `getTenantsForUser`) so the local Hanko
 * flow works without manual seeding.
 */
export const resolveActiveTenant = async (
	userId: string,
): Promise<ResolvedTenant> => {
	const tenants = await getTenantsForUser(userId);
	if (tenants.length === 0) {
		throw new Error(`User ${userId} has no tenant membership`);
	}
	if (tenants.length > 1) {
		throw new Error(
			`User ${userId} belongs to ${tenants.length} tenants; ` +
				`v1 supports a single tenant per user (no switcher).`,
		);
	}
	return tenants[0];
};

const maybeAutoAttachDevTenant = async (
	userId: string,
): Promise<ResolvedTenant | null> => {
	if (process.env.NODE_ENV === "production") return null;
	const slug = process.env.DEV_SEED_TENANT_SLUG;
	if (!slug) return null;
	const tenant = await Tenant.findOne({ where: { slug } });
	if (!tenant) return null;
	await UserTenant.findOrCreate({
		where: { userId, tenantId: tenant.id },
		defaults: { userId, tenantId: tenant.id, role: "member" },
	});
	console.log(
		`[tenant] dev auto-attach: user=${userId} -> tenant=${slug} (id=${tenant.id})`,
	);
	return { id: tenant.id, slug: tenant.slug, name: tenant.name };
};

export const isDeviceInTenant = async (
	deviceId: string,
	tenantId: number,
): Promise<boolean> => {
	const row = await Device.findOne({
		where: { deviceId, tenantId, revokedAt: null },
	});
	return row !== null;
};
