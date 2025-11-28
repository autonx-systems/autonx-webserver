import type { Request, Response } from "express";
import { db } from "../models";

const View = db.models.View;
const Op = db.Sequelize.Op;

// Create and Save a new View
const createView = (req: Request, res: Response) => {
	// Validate request
	if (!req.body.name) {
		res.status(400).send({
			message: "Content can not be empty!",
		});
		return;
	}

	// Create a View
	const view = {
		name: req.body.name,
		description: req.body.description,
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
	const name = req.query.name;
	const options = name
		? { where: { name: { [Op.like]: `%${name}%` } } }
		: undefined;

	View.findAll(options)
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
	const id = req.params.id;

	View.findByPk(id)
		.then((data) => {
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
	const id = req.params.id;

	View.update(req.body, {
		where: { id: id },
	})
		.then(([num]) => {
			if (num === 1) {
				res.send({
					message: "View was updated successfully.",
				});
			} else {
				res.send({
					message: `Cannot update View with id=${id}. Maybe View was not found or req.body is empty!`,
				});
			}
		})
		.catch((err) => {
			res.status(500).send({
				message: "Error updating View with id=" + id,
			});
		});
};

// Delete a View with the specified id in the request
const deleteView = (req: Request, res: Response) => {
	const id = req.params.id;

	View.destroy({
		where: { id: id },
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

// Delete all Views from the database.
const deleteAllViews = (req: Request, res: Response) => {
	View.destroy({
		where: {},
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

export const viewController = {
	create: createView,
	findAll: findAllViews,
	findOne: findOneView,
	update: updateView,
	delete: deleteView,
	deleteAll: deleteAllViews,
};
