import type { Request, Response } from "express";
import type { TenantScopedRequest } from "../middleware/tenant.middleware";
import { db } from "../models";
import { generateViewFromPrompt, editViewFromPrompt } from "../services/view-agent.service";

const View = db.models.View;
const Op = db.Sequelize.Op;

// Create and Save a new View
const createView = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;

	// Validate request
	if (!req.body.name) {
		res.status(400).send({
			message: "Content can not be empty!",
		});
		return;
	}

	// Create a View (tenantId comes from the authenticated context, never the body)
	const view = {
		name: req.body.name,
		description: req.body.description,
    widgets: req.body.widgets,
		tenantId,
	};

	// Save View in the database
	View.create(view)
		.then((data) => {
			res.send(data);
		})
		.catch((err) => {
			res.status(500).send({
				message: err.message || "Some error occurred while creating the View.",
			});
		});
};

// Retrieve all Views from the database.
const findAllViews = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const name = req.query.name;
	const where = name
		? { tenantId, name: { [Op.like]: `%${name}%` } }
		: { tenantId };

	View.findAll({ where })
		.then((data) => {
			res.send(data);
		})
		.catch((err) => {
			res.status(500).send({
				message: err.message || "Some error occurred while retrieving views.",
			});
		});
};

// Find a single View with an id
const findOneView = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const id = req.params.id;

	View.findOne({ where: { id, tenantId } })
		.then((data) => {
      if (!data) {
        res.status(404).send({
          message: `Cannot find View with id=${id}.`
        });
        return;
      }
			res.send(data);
		})
		.catch((err) => {
			res.status(500).send({
				message: "Error retrieving View with id=" + id,
			});
		});
};

// Update a View by the id in the request
const updateView = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const id = req.params.id;

	// Never let the body reassign the row's id or tenant.
	const { tenantId: _ignoredTenantId, id: _ignoredId, ...payload } = req.body;

	View.update(payload, {
		where: { id, tenantId },
	})
		.then(([num]) => {
			if (num === 1) {
        return View.findOne({ where: { id, tenantId } }).then((data) => {
          res.send(data);
        });
			} else {
				res.status(404).send({
					message: `Cannot update View with id=${id}. Maybe View was not found or req.body is empty!`,
				});
			}
		})
		.catch((error) => {
      console.error(error)
			res.status(500).send({
				message: "Error updating View with id=" + id,
			});
		});
};

// Delete a View with the specified id in the request
const deleteView = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const id = req.params.id;

	View.destroy({
		where: { id, tenantId },
	})
		.then((num) => {
			if (num === 1) {
				res.send({
					message: "View was deleted successfully!",
				});
			} else {
				res.send({
					message: `Cannot delete View with id=${id}. Maybe View was not found!`,
				});
			}
		})
		.catch((err) => {
			res.status(500).send({
				message: "Could not delete View with id=" + id,
			});
		});
};

// Delete all Views in the caller's tenant.
const deleteAllViews = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;

	View.destroy({
		where: { tenantId },
		truncate: false,
	})
		.then((nums) => {
			res.send({ message: `${nums} Views were deleted successfully!` });
		})
		.catch((err) => {
			res.status(500).send({
				message: err.message || "Some error occurred while removing all views.",
			});
		});
};

// Generate a view draft from a natural-language prompt. Does not persist;
// the client previews the result and creates the view via POST /views.
const generateView = async (req: Request, res: Response) => {
	const prompt = req.body?.prompt;
	if (typeof prompt !== "string" || prompt.trim().length === 0) {
		res.status(400).send({ message: "A non-empty 'prompt' is required." });
		return;
	}
	if (prompt.length > 2000) {
		res.status(400).send({ message: "Prompt is too long (max 2000 chars)." });
		return;
	}

	try {
		const view = await generateViewFromPrompt(prompt.trim(), req.body?.context);
		res.send(view);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Failed to generate view.";
		console.error("[generateView]", message);
		res.status(502).send({ message });
	}
};

// Edit an existing view from a natural-language instruction. Stateless: takes
// the current widgets, returns the modified widget list plus a change summary.
// The client reconciles the result and persists via PUT /views/:id.
const editView = async (req: Request, res: Response) => {
	const prompt = req.body?.prompt;
	const widgets = req.body?.widgets;

	if (typeof prompt !== "string" || prompt.trim().length === 0) {
		res.status(400).send({ message: "A non-empty 'prompt' is required." });
		return;
	}
	if (prompt.length > 2000) {
		res.status(400).send({ message: "Prompt is too long (max 2000 chars)." });
		return;
	}
	if (!Array.isArray(widgets)) {
		res.status(400).send({ message: "'widgets' must be an array." });
		return;
	}

	const rawRows = req.body?.viewportRows;
	const viewportRows =
		typeof rawRows === "number" && Number.isFinite(rawRows) && rawRows > 0
			? Math.round(rawRows)
			: undefined;

	try {
		const result = await editViewFromPrompt(prompt.trim(), widgets, viewportRows);
		res.send(result);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Failed to edit view.";
		console.error("[editView]", message);
		res.status(502).send({ message });
	}
};

export const viewController = {
	create: createView,
	findAll: findAllViews,
	findOne: findOneView,
	update: updateView,
	delete: deleteView,
	deleteAll: deleteAllViews,
	generate: generateView,
	edit: editView,
};
