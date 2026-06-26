import { describe, expect, it } from "vitest";
import { __testing } from "../app/routes/socket.routes";

const { parseTenantFromTopic, topicAllowed } = __testing;

describe("parseTenantFromTopic", () => {
	it("extracts slug from a device topic", () => {
		expect(
			parseTenantFromTopic("tenants/alpha-co/devices/drone-001a/telemetry"),
		).toBe("alpha-co");
	});

	it("extracts slug from a broadcast topic", () => {
		expect(parseTenantFromTopic("tenants/alpha-co/broadcast/ping")).toBe(
			"alpha-co",
		);
	});

	it("returns null for non-tenant topics", () => {
		expect(parseTenantFromTopic("device/abc/up")).toBeNull();
		expect(parseTenantFromTopic("random/topic")).toBeNull();
	});
});

describe("topicAllowed", () => {
	it("accepts allow-listed device subtrees", () => {
		expect(
			topicAllowed("tenants/alpha-co/devices/drone-001a/telemetry"),
		).toBe(true);
		expect(
			topicAllowed("tenants/alpha-co/devices/drone-001a/telemetry/imu"),
		).toBe(true);
		expect(topicAllowed("tenants/alpha-co/devices/drone-001a/up")).toBe(true);
		expect(topicAllowed("tenants/alpha-co/devices/drone-001a/down")).toBe(
			true,
		);
		expect(
			topicAllowed("tenants/alpha-co/devices/drone-001a/down/cam_test"),
		).toBe(true);
		expect(
			topicAllowed("tenants/alpha-co/devices/drone-001a/down/foo/bar"),
		).toBe(true);
		expect(
			topicAllowed("tenants/alpha-co/devices/drone-001a/mavlink/up"),
		).toBe(true);
		expect(topicAllowed("tenants/alpha-co/broadcast")).toBe(true);
		expect(topicAllowed("tenants/alpha-co/broadcast/foo/bar")).toBe(true);
	});

	it("rejects implementation-detail topics", () => {
		expect(topicAllowed("tenants/alpha-co/devices/drone-001a/relay")).toBe(
			false,
		);
		expect(topicAllowed("tenants/alpha-co/devices/drone-001a/init")).toBe(
			false,
		);
		expect(topicAllowed("tenants/alpha-co/devices/drone-001a/ack")).toBe(
			false,
		);
	});

	it("rejects topics outside the tenant namespace", () => {
		expect(topicAllowed("system/health")).toBe(false);
		expect(topicAllowed("incoming")).toBe(false);
	});
});
