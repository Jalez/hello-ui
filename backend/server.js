const cors = require('cors');
const debug = require('debug');
const express = require('express');

const app = express();
const router = require('./router.js');
const db = require('./models/index.js');
// const OpenAI = require('openai');

// Create logger for debugging
// (Better console.log with colors and does not show any output in production)
const logger = debug('ui_designer:server');

const PORT = 3200;

// save db to app
app.set('db', db);

app.use(cors()); // This will enable CORS for all routes
app.use(express.json());
app.use('/', router);

app.listen(PORT, () => {
  logger(`Server running on http://localhost:${PORT}`);
});
