module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('budgets', 'type', {
      type: Sequelize.ENUM('monthly', 'yearly', 'bi-monthly'),
      allowNull: false,
      defaultValue: 'monthly'
    });

    await queryInterface.addColumn('budgets', 'year', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: new Date().getFullYear()
    });

    await queryInterface.addColumn('budgets', 'startMonth', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('budgets', 'endMonth', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.changeColumn('budgets', 'month', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addIndex('budgets', ['userId', 'type', 'year']);
    await queryInterface.addIndex('budgets', ['userId', 'type', 'year', 'startMonth', 'endMonth']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('budgets', ['userId', 'type', 'year', 'startMonth', 'endMonth']);
    await queryInterface.removeIndex('budgets', ['userId', 'type', 'year']);
    await queryInterface.removeColumn('budgets', 'type');
    await queryInterface.removeColumn('budgets', 'year');
    await queryInterface.removeColumn('budgets', 'startMonth');
    await queryInterface.removeColumn('budgets', 'endMonth');
    await queryInterface.changeColumn('budgets', 'month', {
      type: Sequelize.STRING(255),
      allowNull: false
    });
  }
};