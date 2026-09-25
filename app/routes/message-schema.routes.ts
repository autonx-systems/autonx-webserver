import express from "express";
import { messageSchemaController } from "../controllers/message-schema.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";

export const registerMessageSchemaRoutes = (app: express.Express) => {
	var router = express.Router();

	router.use(authMiddleware);
	router.use(tenantMiddleware);

	// Create a new message schema
	router.post("/", messageSchemaController.create);

	// Retrieve all message schemas (optionally filtered by ?protocol=)
	router.get("/", messageSchemaController.findAll);

	// Retrieve a single message schema with id
	router.get("/:id", messageSchemaController.findOne);

	// Update a message schema with id
	router.put("/:id", messageSchemaController.update);

	// Delete a message schema with id
	router.delete("/:id", messageSchemaController.delete);

	// Delete all message schemas
	router.delete("/", messageSchemaController.deleteAll);

	app.use("/api/message-schemas", router);
};
