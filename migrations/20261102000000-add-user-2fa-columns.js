'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dedicated column for the TOTP secret. It previously lived in
    // reset_token, which also stores password-reset hashes — the two
    // features overwrote each other.
    await queryInterface.addColumn('users', 'totp_secret', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    // Flag that gates the TOTP challenge during login.
    await queryInterface.addColumn('users', 'two_factor_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'two_factor_enabled');
    await queryInterface.removeColumn('users', 'totp_secret');
  }
};
