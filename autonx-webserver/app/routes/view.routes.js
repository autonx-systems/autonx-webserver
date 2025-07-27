module.exports = app => {
  const views = require("../controllers/view.controller.js");

  var router = require("express").Router();

  // Create a new View
  router.post("/", views.create);

  // Retrieve all Views
  router.get("/", views.findAll);

  // Retrieve a single View with id
  router.get("/:id", views.findOne);

  // Update a View with id
  router.put("/:id", views.update);

  // Delete a View with id
  router.delete("/:id", views.delete);

  // Delete all Views
  router.delete("/", views.deleteAll);

  app.use('/api/views', router);
};
