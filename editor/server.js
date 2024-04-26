const express = require('express');
const cors = require('cors');

const app = express();
const router = require('./router.js');
// const OpenAI = require('openai');

const PORT = 3000;
// const openai = new OpenAI();

// TODO:
// - Validation
// - Authentication (for creator, etc.) (username & password + JWT & cookie)
// - maps: canUseAI (true/false)
// - levels: remove UI only properties
// - randomization: select maps randomly

app.use(cors()); // This will enable CORS for all routes
app.use(express.json());
app.use('/', router);

// app.post('/chatGPT', async (req, res) => {
//   const systemPrompt = req.body.systemPrompt;
//   const prompt = req.body.prompt;
//   try {
//     const chatResponse = await openai.chat.completions.create({
//       model: 'gpt-3.5-turbo-1106',
//       response_format: { type: 'json_object' },
//       messages: [
//         {
//           role: 'system',
//           content: systemPrompt
//         },
//         {
//           role: 'user',
//           content: prompt
//         }
//       ]
//     });

//     // Assuming the model returns the correct JSON structure directly
//     console.log(chatResponse.choices[0].message.content);
//     res.json(chatResponse.choices[0].message.content);
//   } catch (error) {
//     res
//       .status(500)
//       .send({ message: 'Failed to fetch response from OpenAI', error });
//   }
// });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
