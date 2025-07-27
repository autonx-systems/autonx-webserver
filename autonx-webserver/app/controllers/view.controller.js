const db = require("../models");
const View = db.views;
const Op = db.Sequelize.Op;

// Create and Save a new View
exports.create = (req, res) => {
  // Validate request
  if (!req.body.title) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
    return;
  }

  // Create a View
  const view = {
    title: req.body.title,
    description: req.body.description
  };

  // Save View in the database
  View.create(view)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the View."
      });
    });
};

// Retrieve all Views from the database.
exports.findAll = (req, res) => {
  const title = req.query.title;
  var condition = title ? { title: { [Op.like]: `%${title}%` } } : null;

  View.findAll({ where: condition })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving views."
      });
    });
};

// Find a single View with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  View.findByPk(id)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: "Error retrieving View with id=" + id
      });
    });
};

// Update a View by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;

  View.update(req.body, {
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "View was updated successfully."
        });
      } else {
        res.send({
          message: `Cannot update View with id=${id}. Maybe View was not found or req.body is empty!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating View with id=" + id
      });
    });
};

// Delete a View with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  View.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "View was deleted successfully!"
        });
      } else {
        res.send({
          message: `Cannot delete View with id=${id}. Maybe View was not found!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Could not delete View with id=" + id
      });
    });
};

// Delete all Views from the database.
exports.deleteAll = (req, res) => {
  View.destroy({
    where: {},
    truncate: false
  })
    .then(nums => {
      res.send({ message: `${nums} Views were deleted successfully!` });
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all views."
      });
    });
};
