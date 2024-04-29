const chatGPTController = require("../controllers/chatGPT.js");

module.exports = (router) => {
  // /chatGPT
  router
    .route("/chatGPT")
    .get(chatGPTController.getChatGPTModels)
    .post(chatGPTController.postChatGPT);
};
