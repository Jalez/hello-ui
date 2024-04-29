const express = require('express');
const cors = require('cors');

const app = express();
const router = require('./router.js');
const db = require('./models/index.js');
// const OpenAI = require('openai');

const PORT = 3000;

// save db to app
app.set('db', db);

app.use(cors()); // This will enable CORS for all routes
app.use(express.json());
app.use('/', router);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
