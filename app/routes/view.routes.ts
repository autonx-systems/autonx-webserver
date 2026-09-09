import express from "express";
import { viewController } from "../controllers/view.controller";

export const registerViewRoutes = (app: express.Express) => {
	var router = express.Router();

	// Create a new View
	router.post("/", viewController.create);

	// Generate a view draft from a natural-language prompt (not persisted)
	router.post("/generate", viewController.generate);

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
