import type { Request, Response } from "express";
import type { TenantScopedRequest } from "../middleware/tenant.middleware";
import { db } from "../models";

const MessageSchema = db.models.MessageSchema;

const VALID_PROTOCOLS = new Set(["ros2", "mavlink"]);

// Accept a definition as a raw object (serialize) or an already-serialized string.
const serializeDefinition = (definition: unknown): string =>
	typeof definition === "string" ? definition : JSON.stringify(definition);

// Create and Save a new message schema
const createMessageSchema = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;

	if (!req.body.name || !req.body.protocol || req.body.definition == null) {
		res.status(400).send({
			message: "Fields 'protocol', 'name' and 'definition' are required.",
		});
		return;
	}
	if (!VALID_PROTOCOLS.has(req.body.protocol)) {
		res.status(400).send({
			message: "Field 'protocol' must be one of: ros2, mavlink.",
		});
		return;
	}

	// tenantId comes from the authenticated context, never the body.
	const schema = {
		protocol: req.body.protocol,
		name: req.body.name,
		definition: serializeDefinition(req.body.definition),
		tenantId,
	};

	MessageSchema.create(schema)
		.then((data) => {
			res.send(data);
		})
		.catch((err) => {
			res.status(500).send({
				message:
					err.message ||
					"Some error occurred while creating the message schema.",
			});
		});
};

// Retrieve all message schemas for the caller's tenant (optionally by protocol).
const findAllMessageSchemas = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const protocol = req.query.protocol as string | undefined;
	const where =
		protocol && VALID_PROTOCOLS.has(protocol)
			? { tenantId, protocol }
			: { tenantId };

	MessageSchema.findAll({ where })
		.then((data) => {
			res.send(data);
		})
		.catch((err) => {
			res.status(500).send({
				message:
					err.message ||
					"Some error occurred while retrieving message schemas.",
			});
		});
};

// Find a single message schema with an id
const findOneMessageSchema = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const id = req.params.id;

	MessageSchema.findOne({ where: { id, tenantId } })
		.then((data) => {
			if (!data) {
				res.status(404).send({
					message: `Cannot find message schema with id=${id}.`,
				});
				return;
			}
			res.send(data);
		})
		.catch(() => {
			res.status(500).send({
				message: "Error retrieving message schema with id=" + id,
			});
		});
};

// Update a message schema by the id in the request
const updateMessageSchema = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const id = req.params.id;

	// Never let the body reassign the row's id or tenant.
	const {
		tenantId: _ignoredTenantId,
		id: _ignoredId,
		definition,
		...rest
	} = req.body;
	const payload =
		definition !== undefined
			? { ...rest, definition: serializeDefinition(definition) }
			: rest;

	MessageSchema.update(payload, { where: { id, tenantId } })
		.then(([num]) => {
			if (num === 1) {
				return MessageSchema.findOne({ where: { id, tenantId } }).then(
					(data) => {
						res.send(data);
					},
				);
			}
			res.status(404).send({
				message: `Cannot update message schema with id=${id}. Maybe it was not found or req.body is empty!`,
			});
		})
		.catch((error) => {
			console.error(error);
			res.status(500).send({
				message: "Error updating message schema with id=" + id,
			});
		});
};

// Delete a message schema with the specified id in the request
const deleteMessageSchema = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;
	const id = req.params.id;

	MessageSchema.destroy({ where: { id, tenantId } })
		.then((num) => {
			if (num === 1) {
				res.send({ message: "Message schema was deleted successfully!" });
			} else {
				res.send({
					message: `Cannot delete message schema with id=${id}. Maybe it was not found!`,
				});
			}
		})
		.catch(() => {
			res.status(500).send({
				message: "Could not delete message schema with id=" + id,
			});
		});
};

// Delete all message schemas in the caller's tenant.
const deleteAllMessageSchemas = (req: Request, res: Response) => {
	const tenantId = (req as TenantScopedRequest).tenantId as number;

	MessageSchema.destroy({ where: { tenantId }, truncate: false })
		.then((nums) => {
			res.send({ message: `${nums} message schemas were deleted successfully!` });
		})
		.catch((err) => {
			res.status(500).send({
				message:
					err.message ||
					"Some error occurred while removing all message schemas.",
			});
		});
};

export const messageSchemaController = {
	create: createMessageSchema,
	findAll: findAllMessageSchemas,
	findOne: findOneMessageSchema,
	update: updateMessageSchema,
	delete: deleteMessageSchema,
	deleteAll: deleteAllMessageSchemas,
};
