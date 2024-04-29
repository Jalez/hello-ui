const express = require("express");
const setupChatGPT = require("./routes/chatGPT.js");

const router = express.Router();

setupChatGPT(router);

module.exports = router;
