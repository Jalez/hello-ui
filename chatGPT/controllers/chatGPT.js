const OpenAI = require("openai");
const openai = new OpenAI();

const models = [
  {
    mode: "gpt-3.5-turbo-1106",
    name: "GPT-3.5 Turbo (JSON)",
    description:
      "The GPT-3.5 Turbo model is a variant of the GPT-3.5 model that is optimized for speed and can generate responses faster than the standard GPT-3.5 model. It is also capable of generating responses in JSON format, which can be useful for integrating the model with other applications and services. The GPT-3.5 Turbo model is well-suited for chatbot applications, question-answering systems, and other natural language processing tasks that require fast response times.",
  },
];

const getChatGPTModels = (req, res) => {
  res.json(models);
};

const postChatGPT = async (req, res) => {
  const systemPrompt = req.body.systemPrompt;
  const prompt = req.body.prompt;
  try {
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    res.json(chatResponse.choices[0].message.content);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to fetch response from OpenAI", error });
  }
};

module.exports = {
  getChatGPTModels,
  postChatGPT,
};
