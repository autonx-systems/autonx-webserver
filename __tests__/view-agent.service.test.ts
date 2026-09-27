import { describe, expect, it } from "vitest";

import {
	__testing,
	type AgentContext,
	type GeneratedWidget,
} from "../app/services/view-agent.service";

const { groundWidgetBindings, buildSystemPrompt } = __testing;

const context: AgentContext = {
	devices: [
		{
			id: "drone-alpha",
			topics: [
				{
					topic: "/gps/fix",
					protocol: "ros2",
					schema: "sensor_msgs/msg/NavSatFix",
				},
			],
		},
	],
	schemas: [
		{
			name: "sensor_msgs/msg/NavSatFix",
			protocol: "ros2",
			fields: ["latitude", "longitude", "altitude"],
		},
	],
	widgetPorts: { "gauge-round": ["value"], "moving-map": ["lat", "lon"] },
};

const widget = (
	bindings: GeneratedWidget["bindings"],
	type = "gauge-round",
): GeneratedWidget => ({
	type,
	title: "Test",
	dataGrid: { x: 0, y: 0, w: 3, h: 4 },
	bindings,
});

describe("groundWidgetBindings", () => {
	it("keeps a valid binding and re-derives protocol/schema from the topic", () => {
		const result = groundWidgetBindings(
			widget({
				value: {
					device: "drone-alpha",
					topic: "/gps/fix",
					protocol: "mavlink", // wrong on purpose
					schema: "bogus", // wrong on purpose
					path: "altitude",
				},
			}),
			context,
		);

		expect(result.bindings).toEqual({
			value: {
				device: "drone-alpha",
				topic: "/gps/fix",
				protocol: "ros2",
				schema: "sensor_msgs/msg/NavSatFix",
				path: "altitude",
			},
		});
	});

	it("drops a binding to an unknown device", () => {
		const result = groundWidgetBindings(
			widget({
				value: {
					device: "ghost",
					topic: "/gps/fix",
					protocol: "ros2",
					schema: "sensor_msgs/msg/NavSatFix",
					path: "altitude",
				},
			}),
			context,
		);
		expect(result.bindings).toBeUndefined();
	});

	it("drops a binding to an unknown topic", () => {
		const result = groundWidgetBindings(
			widget({
				value: {
					device: "drone-alpha",
					topic: "/missing",
					protocol: "ros2",
					schema: "sensor_msgs/msg/NavSatFix",
					path: "altitude",
				},
			}),
			context,
		);
		expect(result.bindings).toBeUndefined();
	});

	it("drops a binding to a port the widget type does not expose", () => {
		const result = groundWidgetBindings(
			widget({
				lat: {
					device: "drone-alpha",
					topic: "/gps/fix",
					protocol: "ros2",
					schema: "sensor_msgs/msg/NavSatFix",
					path: "latitude",
				},
			}),
			context,
		);
		expect(result.bindings).toBeUndefined();
	});

	it("strips all bindings when no context is provided", () => {
		const result = groundWidgetBindings(
			widget({
				value: {
					device: "drone-alpha",
					topic: "/gps/fix",
					protocol: "ros2",
					schema: "sensor_msgs/msg/NavSatFix",
					path: "altitude",
				},
			}),
			undefined,
		);
		expect(result.bindings).toBeUndefined();
	});
});

describe("buildSystemPrompt", () => {
	it("tells the model not to bind when no devices are connected", () => {
		const prompt = buildSystemPrompt({
			devices: [],
			schemas: [],
			widgetPorts: {},
		});
		expect(prompt).toContain("none are currently connected");
	});

	it("lists live devices, topics, fields, and bindable ports", () => {
		const prompt = buildSystemPrompt(context);
		expect(prompt).toContain("drone-alpha");
		expect(prompt).toContain("/gps/fix");
		expect(prompt).toContain("latitude");
		expect(prompt).toContain("gauge-round: value");
	});
});
