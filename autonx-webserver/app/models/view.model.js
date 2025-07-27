module.exports = (sequelize, Sequelize) => {
  const View = sequelize.define("view", {
    title: {
      type: Sequelize.STRING
    },
    description: {
      type: Sequelize.STRING
    }
  });

  return View;
};
