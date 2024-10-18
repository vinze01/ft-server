const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const routes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

// Sync database
sequelize.sync()
  .then(() => console.log('Database synced'))
  .catch(err => console.error('Error syncing database:', err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
