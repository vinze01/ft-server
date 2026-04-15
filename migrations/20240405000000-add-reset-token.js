module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'resetToken', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('users', 'resetTokenExpiry', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'resetToken');
    await queryInterface.removeColumn('users', 'resetTokenExpiry');
  }
};