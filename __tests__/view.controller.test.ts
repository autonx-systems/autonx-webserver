import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Sequelize model layer so the controller never touches a real DB.
const { View } = vi.hoisted(() => ({
	View: {
		create: vi.fn(),
		findAll: vi.fn(),
		findOne: vi.fn(),
		update: vi.fn(),
		destroy: vi.fn(),
	},
}));

vi.mock("../app/models", () => ({
	db: {
		models: { View },
		// Controller uses `db.Sequelize.Op.like`; a string key is enough here.
		Sequelize: { Op: { like: "LIKE" } },
	},
}));

import { viewController } from "../app/controllers/view.controller";

const TENANT = 7;

type AnyReq = {
	body?: Record<string, unknown>;
	query?: Record<string, unknown>;
	params?: Record<string, unknown>;
	tenantId?: number;
};

const makeReq = (overrides: AnyReq = {}): AnyReq => ({
	body: {},
	query: {},
	params: {},
	tenantId: TENANT,
	...overrides,
});

const makeRes = () => {
	const res: Record<string, unknown> & {
		statusCode: number;
		body: unknown;
	} = {
		statusCode: 200,
		body: undefined,
	};
	res.status = vi.fn((code: number) => {
		res.statusCode = code;
		return res;
	});
	res.send = vi.fn((payload: unknown) => {
		res.body = payload;
		return res;
	});
	res.json = vi.fn((payload: unknown) => {
		res.body = payload;
		return res;
	});
	return res;
};

// Flush pending promise microtasks/macrotasks created by the controller chains.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	vi.clearAllMocks();
	View.create.mockResolvedValue({ id: 1 });
	View.findAll.mockResolvedValue([]);
	View.findOne.mockResolvedValue({ id: 1, tenantId: TENANT });
	View.update.mockResolvedValue([1]);
	View.destroy.mockResolvedValue(1);
});

describe("view controller tenant isolation", () => {
	it("create stamps the caller's tenantId and ignores a body-supplied tenantId", async () => {
		const req = makeReq({
			body: { name: "Map", widgets: "[]", tenantId: 999 },
		});
		const res = makeRes();

		viewController.create(req as never, res as never);
		await flush();

		expect(View.create).toHaveBeenCalledTimes(1);
		const arg = View.create.mock.calls[0][0];
		expect(arg.tenantId).toBe(TENANT);
		expect(arg.tenantId).not.toBe(999);
		expect(arg.name).toBe("Map");
	});

	it("findAll filters by tenantId", async () => {
		const req = makeReq();
		const res = makeRes();

		viewController.findAll(req as never, res as never);
		await flush();

		expect(View.findAll).toHaveBeenCalledTimes(1);
		const arg = View.findAll.mock.calls[0][0];
		expect(arg.where.tenantId).toBe(TENANT);
	});

	it("findAll keeps the tenant filter alongside a name search", async () => {
		const req = makeReq({ query: { name: "dash" } });
		const res = makeRes();

		viewController.findAll(req as never, res as never);
		await flush();

		const arg = View.findAll.mock.calls[0][0];
		expect(arg.where.tenantId).toBe(TENANT);
		expect(arg.where.name).toHaveProperty("LIKE");
	});

	it("findOne is scoped to the tenant", async () => {
		const req = makeReq({ params: { id: "5" } });
		const res = makeRes();

		viewController.findOne(req as never, res as never);
		await flush();

		expect(View.findOne).toHaveBeenCalledWith({
			where: { id: "5", tenantId: TENANT },
		});
	});

	it("findOne returns 404 for a view outside the tenant", async () => {
		View.findOne.mockResolvedValueOnce(null);
		const req = makeReq({ params: { id: "5" } });
		const res = makeRes();

		viewController.findOne(req as never, res as never);
		await flush();

		expect(res.statusCode).toBe(404);
	});

	it("update is tenant-scoped and strips id/tenantId from the payload", async () => {
		const req = makeReq({
			params: { id: "5" },
			body: { name: "Renamed", tenantId: 999, id: 111 },
		});
		const res = makeRes();

		viewController.update(req as never, res as never);
		await flush();

		expect(View.update).toHaveBeenCalledTimes(1);
		const [payload, options] = View.update.mock.calls[0];
		expect(payload).toEqual({ name: "Renamed" });
		expect(payload).not.toHaveProperty("tenantId");
		expect(payload).not.toHaveProperty("id");
		expect(options.where).toEqual({ id: "5", tenantId: TENANT });
	});

	it("update returns 404 when no row in the tenant matched", async () => {
		View.update.mockResolvedValueOnce([0]);
		const req = makeReq({ params: { id: "5" }, body: { name: "x" } });
		const res = makeRes();

		viewController.update(req as never, res as never);
		await flush();

		expect(res.statusCode).toBe(404);
	});

	it("delete is tenant-scoped", async () => {
		const req = makeReq({ params: { id: "5" } });
		const res = makeRes();

		viewController.delete(req as never, res as never);
		await flush();

		expect(View.destroy).toHaveBeenCalledWith({
			where: { id: "5", tenantId: TENANT },
		});
	});

	it("deleteAll only wipes the caller's tenant, never all tenants", async () => {
		const req = makeReq();
		const res = makeRes();

		viewController.deleteAll(req as never, res as never);
		await flush();

		expect(View.destroy).toHaveBeenCalledTimes(1);
		const arg = View.destroy.mock.calls[0][0];
		expect(arg.where).toEqual({ tenantId: TENANT });
		// Guard against the old global `where: {}` regression.
		expect(Object.keys(arg.where)).toContain("tenantId");
	});
});
