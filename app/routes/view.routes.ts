import express from "express";
import { viewController } from "../controllers/view.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";

export const registerViewRoutes = (app: express.Express) => {
	var router = express.Router();

	router.use(authMiddleware);
	router.use(tenantMiddleware);

	// Create a new View
	router.post("/", viewController.create);

	// Retrieve all Views
	router.get("/", viewController.findAll);

	// Retrieve a single View with id
	router.get("/:id", viewController.findOne);

	// Update a View with id
	router.put("/:id", viewController.update);

	// Delete a View with id
	router.delete("/:id", viewController.delete);

	// Delete all Views
	router.delete("/", viewController.deleteAll);

	app.use("/api/views", router);
};
