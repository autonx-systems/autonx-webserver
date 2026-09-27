import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

import { WIDGET_CATALOG, WIDGET_TYPE_IDS } from "../config/widget-catalog";

const GRID_COLUMNS = 12;

// Live data snapshot the frontend sends with a generate request
// (autonx-app/src/features/view-agent/utils/build-agent-context.ts).
export type AgentContext = {
	devices: Array<{
		id: string;
		topics: Array<{ topic: string; protocol?: string; schema?: string }>;
	}>;
	schemas: Array<{
		name: string;
		protocol: "ros2" | "mavlink";
		fields: string[];
	}>;
	widgetPorts: Record<string, string[]>;
};

// One data source wired to a widget input port. Mirrors the frontend
// DataBinding (autonx-app/src/features/widget-editor/compile-bindings-to-graph.ts),
// which expands it into a variable -> path -> widget node chain.
const dataBindingSchema = z.object({
	device: z.string().describe("Device id from the live sources."),
	topic: z.string().describe("Topic name from that device."),
	protocol: z.enum(["ros2", "mavlink"]),
	schema: z.string().describe("Message schema name for the topic."),
	path: z.string().describe("Dotted field path within the message."),
});

export type DataBinding = z.infer<typeof dataBindingSchema>;

// Mirrors the frontend WidgetInstance shape (autonx-app/src/shared/types/widget.ts).
// The agent only fills the fields it can reason about; runtime defaults cover the rest.
const generatedWidgetSchema = z.object({
	type: z
		.enum(WIDGET_TYPE_IDS as [string, ...string[]])
		.describe("Widget type id from the catalog."),
	title: z.string().describe("Short human-readable title for the widget."),
	dataGrid: z
		.object({
			x: z.number().int().min(0).max(GRID_COLUMNS - 1),
			y: z.number().int().min(0),
			w: z.number().int().min(1).max(GRID_COLUMNS),
			h: z.number().int().min(1),
		})
		.describe("Position/size on a 12-column grid."),
	bindings: z
		.record(z.string(), dataBindingSchema)
		.nullable()
		.optional()
		.describe(
			"Map of widget input-port name -> live data source. Only bind ports that fit the request; omit if no live source applies.",
		),
});

const generatedViewSchema = z.object({
	name: z.string().describe("Concise name for the view."),
	description: z.string().describe("One-sentence summary of the view."),
	widgets: z.array(generatedWidgetSchema).min(1),
});

export type GeneratedWidget = z.infer<typeof generatedWidgetSchema>;
export type GeneratedView = z.infer<typeof generatedViewSchema>;

// Edit flow: widgets keep an optional `key` so the client can reconcile the
// result against existing widgets (preserving their data-flow graphs).
const editedWidgetSchema = generatedWidgetSchema.extend({
	key: z
		.string()
		.nullable()
		.optional()
		.describe("Existing widget key to keep/move, or null for a new widget."),
	fields: z
		.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
		.nullable()
		.optional()
		.describe(
			"Only the config fields you changed (e.g. { orientation: 'vertical' }). Omit if unchanged.",
		),
});

const editedViewSchema = z.object({
	summary: z
		.string()
		.describe("One short sentence describing the changes that were made."),
	widgets: z.array(editedWidgetSchema),
});

export type EditedWidget = z.infer<typeof editedWidgetSchema>;
export type EditedView = z.infer<typeof editedViewSchema>;

// Minimal current-widget shape the client sends for editing.
export type CurrentWidget = {
	key: string;
	type: string;
	title?: string | null;
	dataGrid: { x: number; y: number; w: number; h: number };
	fields?: Record<string, string | number | boolean> | null;
};

const buildSystemPrompt = (context?: AgentContext): string => {
	const catalog = WIDGET_CATALOG.map(
		(w) =>
			`- ${w.type} (${w.category}): ${w.description} default size ${w.defaultSize.w}x${w.defaultSize.h}`,
	).join("\n");

	return [
		"You are a dashboard layout agent for a robotics/telemetry control app.",
		"Given a natural-language request, design a view composed of widgets.",
		"",
		"Rules:",
		"- Only use widget types from the catalog below. Never invent a type.",
		`- The grid has ${GRID_COLUMNS} columns. x + w must not exceed ${GRID_COLUMNS}.`,
		"- Prefer the catalog default sizes unless the request implies otherwise.",
		"- Lay widgets out top-to-bottom, left-to-right without overlaps.",
		"- Pick a sensible number of widgets (typically 3-8) that answer the request.",
		"- Give every widget a short, specific title.",
		"",
		buildContextSection(context),
		"",
		"Widget catalog:",
		catalog,
	].join("\n");
};

// Live telemetry catalogue + bindable ports the agent may wire widgets to.
const buildContextSection = (context?: AgentContext): string => {
	if (!context || context.devices.length === 0) {
		return [
			"Live data sources: none are currently connected.",
			"Do not add any `bindings`; emit widgets with layout only.",
		].join("\n");
	}

	const fieldsBySchema = new Map(
		context.schemas.map((s) => [s.name, s.fields] as const),
	);

	const devices = context.devices
		.map((device) => {
			const topics = device.topics
				.map((topic) => {
					const fields = topic.schema
						? fieldsBySchema.get(topic.schema)
						: undefined;
					const fieldList = fields?.length
						? ` — fields: ${fields.join(", ")}`
						: "";
					return `    - topic "${topic.topic}" (protocol: ${topic.protocol ?? "unknown"}, schema: ${topic.schema ?? "unknown"})${fieldList}`;
				})
				.join("\n");
			return `  device "${device.id}":\n${topics}`;
		})
		.join("\n");

	const ports = Object.entries(context.widgetPorts)
		.map(([type, keys]) => `  - ${type}: ${keys.join(", ")}`)
		.join("\n");

	return [
		"Live data sources — bind widgets to these. Never invent a device, topic, schema, or field:",
		devices,
		"",
		"Bindable input ports per widget type:",
		ports,
		"",
		"Data-binding rules:",
		"- For each widget, add a `bindings` object mapping an input port (from the list above) to a data source.",
		"- Each binding is { device, topic, protocol, schema, path }.",
		"- `device` and `topic` MUST come from the live sources above; `path` MUST be one of that topic's fields.",
		"- Copy `protocol` and `schema` verbatim from the matching topic.",
		"- Only bind ports that fit the request; omit `bindings` entirely when no live source applies.",
	].join("\n");
};

// Reflow widgets into a non-overlapping 12-column layout, preserving the
// agent's ordering. LLMs are unreliable at pixel-perfect grids. Generic so it
// keeps any extra fields (e.g. `key`) on the widget it's handed.
const normalizeLayout = <T extends { dataGrid: GeneratedWidget["dataGrid"] }>(
	widgets: T[],
): T[] => {
	let cursorX = 0;
	let rowY = 0;
	let rowHeight = 0;

	return widgets.map((widget) => {
		const w = Math.min(Math.max(widget.dataGrid.w, 1), GRID_COLUMNS);
		const h = Math.max(widget.dataGrid.h, 1);

		if (cursorX + w > GRID_COLUMNS) {
			cursorX = 0;
			rowY += rowHeight;
			rowHeight = 0;
		}

		const placed: T = {
			...widget,
			dataGrid: { x: cursorX, y: rowY, w, h },
		};

		cursorX += w;
		rowHeight = Math.max(rowHeight, h);
		return placed;
	});
};

// Clamp each widget to the 12-column grid while preserving the agent's chosen
// position. Unlike normalizeLayout (used for fresh generations), this keeps
// explicit placements so edit requests like "cover the right half" are honored.
const clampLayout = <T extends { dataGrid: GeneratedWidget["dataGrid"] }>(
	widgets: T[],
): T[] =>
	widgets.map((widget) => {
		const w = Math.min(Math.max(widget.dataGrid.w, 1), GRID_COLUMNS);
		const x = Math.min(Math.max(widget.dataGrid.x, 0), GRID_COLUMNS - w);
		const y = Math.max(widget.dataGrid.y, 0);
		const h = Math.max(widget.dataGrid.h, 1);
		return { ...widget, dataGrid: { x, y, w, h } };
	});

let cachedModel: ReturnType<ReturnType<typeof createAnthropic>> | null = null;

const getModel = () => {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error("ANTHROPIC_API_KEY is not configured.");
	}
	if (!cachedModel) {
		const anthropic = createAnthropic({ apiKey });
		const modelId = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
		cachedModel = anthropic(modelId);
	}
	return cachedModel;
};

export const generateViewFromPrompt = async (
	prompt: string,
	context?: AgentContext,
): Promise<GeneratedView> => {
	const { object } = await generateObject({
		model: getModel(),
		schema: generatedViewSchema,
		system: buildSystemPrompt(context),
		prompt,
	});

	return {
		...object,
		widgets: normalizeLayout(object.widgets).map((widget) =>
			groundWidgetBindings(widget, context),
		),
	};
};

// Drop any binding the model hallucinated: keep only ports valid for the widget
// type and sources (device + topic) that exist in the live catalogue. protocol
// and schema are re-derived from the matched topic so they can't drift.
const groundWidgetBindings = <T extends GeneratedWidget>(
	widget: T,
	context?: AgentContext,
): T => {
	if (!widget.bindings) return widget;
	if (!context) return { ...widget, bindings: undefined };

	const deviceIndex = new Map(context.devices.map((d) => [d.id, d] as const));
	const validPorts = context.widgetPorts?.[widget.type];

	const grounded: Record<string, DataBinding> = {};
	for (const [port, binding] of Object.entries(widget.bindings)) {
		if (validPorts && !validPorts.includes(port)) continue;
		const device = deviceIndex.get(binding.device);
		if (!device) continue;
		const topic = device.topics.find((t) => t.topic === binding.topic);
		if (!topic) continue;
		if (!binding.path) continue;

		grounded[port] = {
			device: binding.device,
			topic: binding.topic,
			protocol:
				(topic.protocol as DataBinding["protocol"]) ?? binding.protocol,
			schema: topic.schema ?? binding.schema,
			path: binding.path,
		};
	}

	return {
		...widget,
		bindings: Object.keys(grounded).length > 0 ? grounded : undefined,
	};
};

const buildEditSystemPrompt = (
	current: CurrentWidget[],
	viewportRows?: number,
): string => {
	const catalog = WIDGET_CATALOG.map(
		(w) =>
			`- ${w.type} (${w.category}): ${w.description} default size ${w.defaultSize.w}x${w.defaultSize.h}`,
	).join("\n");

	const currentList = JSON.stringify(
		current.map((w) => ({
			key: w.key,
			type: w.type,
			title: w.title ?? "",
			dataGrid: w.dataGrid,
			fields: w.fields ?? {},
		})),
		null,
		2,
	);

	const fullHeightRule =
		typeof viewportRows === "number"
			? `- Full height / 'cover the whole ... side/screen' means y:0 and h:${viewportRows} (the viewport is about ${viewportRows} rows tall). Do NOT just match the other widgets' height.`
			: "- Full height / 'cover the whole ... side/screen' means y:0 and a tall h (e.g. 20+ rows), not just matching the other widgets' height.";

	return [
		"You are editing an existing robotics/telemetry dashboard view.",
		"The user will ask to change it: move, resize, rename, add, or remove widgets.",
		"",
		"Rules:",
		"- Only use widget types from the catalog below. Never invent a type.",
		"- Return the COMPLETE resulting widget list, not just the changes.",
		"- Keep the existing `key` for every widget you keep or move.",
		"- Set `key` to null for any widget you add.",
		"- Omit widgets the user wants removed.",
		"- Only make the changes the user asked for; keep every other widget's position and size exactly as it is.",
		"- Give every widget a short, specific title.",
		"",
		"Layout coordinates (honor position/size requests precisely):",
		`- The grid is ${GRID_COLUMNS} columns wide. Each widget has integer x (0-${GRID_COLUMNS - 1}), y (0+), w (1-${GRID_COLUMNS}), h (1+). x + w must not exceed ${GRID_COLUMNS}.`,
		`- Left half = x:0, w:${GRID_COLUMNS / 2}. Right half = x:${GRID_COLUMNS / 2}, w:${GRID_COLUMNS / 2}. Full width = x:0, w:${GRID_COLUMNS}.`,
		fullHeightRule,
		"- When you move or resize a widget, reposition the OTHER widgets so nothing overlaps (widgets must not share the same cells). Compact them into the remaining space.",
		"- Preserve exact x/y/w/h for any widget the request does not affect.",
		"",
		"Widget config fields:",
		"- Each widget lists its current `fields` (appearance/behaviour config).",
		"- To change a widget's config, return a `fields` object containing ONLY the keys you change; keep their value types (string/number/boolean).",
		"- Examples: a gauge-linear supports `orientation` ('horizontal' | 'vertical') and `color`; gauges support `minValue`/`maxValue`. Only use field keys that already appear on that widget.",
		"- Do not include `fields` for a widget you are not reconfiguring.",
		"",
		"Current widgets:",
		currentList,
		"",
		"Widget catalog:",
		catalog,
	].join("\n");
};

export const editViewFromPrompt = async (
	prompt: string,
	currentWidgets: CurrentWidget[],
	viewportRows?: number,
): Promise<EditedView> => {
	const { object } = await generateObject({
		model: getModel(),
		schema: editedViewSchema,
		system: buildEditSystemPrompt(currentWidgets, viewportRows),
		prompt,
	});

	return {
		summary: object.summary,
		widgets: clampLayout(object.widgets),
	};
};

// Exposed for unit tests.
export const __testing = { groundWidgetBindings, buildSystemPrompt };
