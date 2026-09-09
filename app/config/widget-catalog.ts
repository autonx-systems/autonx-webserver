// Machine-readable widget catalog the view agent selects from.
// Keep the `type` ids in sync with the frontend widget registry
// (autonx-app/src/features/widgets/registry/index.ts).

export type WidgetCategory = "monitoring" | "map3d" | "control";

export type WidgetCatalogEntry = {
	type: string;
	name: string;
	description: string;
	category: WidgetCategory;
	/** Suggested default size on the 12-column grid. */
	defaultSize: { w: number; h: number };
};

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
	{
		type: "moving-map",
		name: "Moving Map",
		description: "2D map that tracks a device position and heading.",
		category: "map3d",
		defaultSize: { w: 6, h: 8 },
	},
	{
		type: "view-3d",
		name: "3D View",
		description: "3D globe/scene visualization (Cesium).",
		category: "map3d",
		defaultSize: { w: 6, h: 8 },
	},
	{
		type: "data-label",
		name: "Data Label",
		description: "Display a live value with unit and custom styling.",
		category: "monitoring",
		defaultSize: { w: 2, h: 2 },
	},
	{
		type: "gauge-linear",
		name: "Linear Gauge",
		description: "Horizontal/vertical bar gauge for a bounded value.",
		category: "monitoring",
		defaultSize: { w: 2, h: 4 },
	},
	{
		type: "gauge-round",
		name: "Round Gauge",
		description: "Circular dial gauge for a bounded value (e.g. altitude, speed).",
		category: "monitoring",
		defaultSize: { w: 3, h: 4 },
	},
	{
		type: "chart",
		name: "Time-Series Chart",
		description: "Scrolling chart with a configurable time window.",
		category: "monitoring",
		defaultSize: { w: 6, h: 5 },
	},
	{
		type: "log",
		name: "Log",
		description: "Scrolling text log of incoming messages.",
		category: "monitoring",
		defaultSize: { w: 6, h: 5 },
	},
	{
		type: "video-stream",
		name: "Video Stream",
		description: "Live video feed from a device camera.",
		category: "monitoring",
		defaultSize: { w: 6, h: 5 },
	},
	{
		type: "traffic-light",
		name: "Traffic Light",
		description: "Status indicator with red/amber/green states.",
		category: "monitoring",
		defaultSize: { w: 2, h: 3 },
	},
	{
		type: "button",
		name: "Button",
		description: "Command button that publishes a message on click.",
		category: "control",
		defaultSize: { w: 2, h: 2 },
	},
	{
		type: "gamepad",
		name: "Gamepad",
		description: "Virtual joystick/gamepad for manual control.",
		category: "control",
		defaultSize: { w: 4, h: 4 },
	},
	{
		type: "streamdeck",
		name: "Stream Deck",
		description: "Grid of configurable command buttons.",
		category: "control",
		defaultSize: { w: 4, h: 4 },
	},
	{
		type: "input-field",
		name: "Input Field",
		description: "Text/number input that publishes a value.",
		category: "control",
		defaultSize: { w: 3, h: 2 },
	},
	{
		type: "slider",
		name: "Slider",
		description: "Slider that publishes a value within a range.",
		category: "control",
		defaultSize: { w: 3, h: 2 },
	},
	{
		type: "radio-buttons",
		name: "Radio Buttons",
		description: "Single-choice control from a set of options.",
		category: "control",
		defaultSize: { w: 3, h: 3 },
	},
	{
		type: "toggle-switch",
		name: "Toggle Switch",
		description: "Boolean on/off switch that publishes a value.",
		category: "control",
		defaultSize: { w: 2, h: 2 },
	},
	{
		type: "dropdown",
		name: "Dropdown",
		description: "Select control that publishes the chosen option.",
		category: "control",
		defaultSize: { w: 3, h: 2 },
	},
	{
		type: "checkbox-group",
		name: "Checkbox Group",
		description: "Multi-choice control from a set of options.",
		category: "control",
		defaultSize: { w: 3, h: 3 },
	},
];

export const WIDGET_TYPE_IDS = WIDGET_CATALOG.map((w) => w.type);
