const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const cors = require("cors");
const app = express();
const PORT = 3000;
const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI();

app.use(cors()); // This will enable CORS for all routes
app.use(bodyParser.json());

const DATA_FILE = "./data.json";

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

app.get("/data", (req, res) => {
  res.json(readData());
});

app.post("/data", (req, res) => {
  console.log("POST");
  console.log("req.body", req.body);
  writeData(req.body);
  res.send("Data updated successfully");
});

app.put("/data", (req, res) => {
  let currentData = readData();
  currentData = { ...currentData, ...req.body };
  writeData(currentData);
  res.json({ message: "Data modified successfully" }); // Ensure JSON response
});

app.delete("/data", (req, res) => {
  writeData({}); // Clear the data
  res.send("Data cleared successfully");
});

app.post("/chatGPT", async (req, res) => {
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

    // Assuming the model returns the correct JSON structure directly
    console.log(chatResponse.choices[0].message.content);
    res.json(chatResponse.choices[0].message.content);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to fetch response from OpenAI", error });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
