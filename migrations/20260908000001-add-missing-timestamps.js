module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('account_transfers', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('savings_allocations', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('notifications', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('insights_cache', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('sessions', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('user_notification_settings', 'created_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('account_transfers', 'updated_at');
    await queryInterface.removeColumn('savings_allocations', 'updated_at');
    await queryInterface.removeColumn('notifications', 'updated_at');
    await queryInterface.removeColumn('insights_cache', 'updated_at');
    await queryInterface.removeColumn('sessions', 'updated_at');
    await queryInterface.removeColumn('user_notification_settings', 'created_at');
  }
};
