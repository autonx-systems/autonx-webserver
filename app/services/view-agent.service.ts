import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

import { WIDGET_CATALOG, WIDGET_TYPE_IDS } from "../config/widget-catalog";

const GRID_COLUMNS = 12;

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
});

const generatedViewSchema = z.object({
	name: z.string().describe("Concise name for the view."),
	description: z.string().describe("One-sentence summary of the view."),
	widgets: z.array(generatedWidgetSchema).min(1),
});

export type GeneratedWidget = z.infer<typeof generatedWidgetSchema>;
export type GeneratedView = z.infer<typeof generatedViewSchema>;

const buildSystemPrompt = (): string => {
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
		"Widget catalog:",
		catalog,
	].join("\n");
};

// Reflow widgets into a non-overlapping 12-column layout, preserving the
// agent's ordering. LLMs are unreliable at pixel-perfect grids.
const normalizeLayout = (widgets: GeneratedWidget[]): GeneratedWidget[] => {
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

		const placed: GeneratedWidget = {
			...widget,
			dataGrid: { x: cursorX, y: rowY, w, h },
		};

		cursorX += w;
		rowHeight = Math.max(rowHeight, h);
		return placed;
	});
};

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
): Promise<GeneratedView> => {
	const { object } = await generateObject({
		model: getModel(),
		schema: generatedViewSchema,
		system: buildSystemPrompt(),
		prompt,
	});

	return {
		...object,
		widgets: normalizeLayout(object.widgets),
	};
};
