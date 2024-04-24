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

const LEVELS_FILE = "./levels.json";
const LEVEL_MAPS_FILE = "./maps.json";

function readData() {
  return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
}

function readLevelMaps() {
  return JSON.parse(fs.readFileSync(LEVEL_MAPS_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2), "utf8");
}

function writeLevelMaps(data) {
  fs.writeFileSync(LEVEL_MAPS_FILE, JSON.stringify(data, null, 2), "utf8");
}

app.get("/data", (req, res) => {
  res.json(readData());
});

//Get all level names
app.get("/data/names", async (req, res) => {
  try {
    const data = readData();
    const levelNames = Object.keys(data);
    res.json(levelNames);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch data", error });
  }
});

app.get("/maps", (req, res) => {
  try {
    res.json(readLevelMaps());
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch data", error });
  }
});

app.get("/maps/names", async (req, res) => {
  try {
    const maps = readLevelMaps();
    const mapNames = Object.keys(maps);
    res.json(mapNames);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch data", error });
  }
});

//Get all levels in a map
app.get("/maps/:name", async (req, res) => {
  try {
    const mapName = req.query.name;
    const maps = readLevelMaps();
    res.json(maps[mapName]);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch data", error });
  }
});

app.post("/data", (req, res) => {
  try {
    console.log("POST");
    console.log("req.body", req.body);
    writeData(req.body);
    res.send({ message: "Data updated successfully", data: req.body });
  } catch (error) {
    res.status(500).send({ message: "Failed to update data", error });
  }
});

// Add new map
app.post("/maps", (req, res) => {
  try {
    let currentData = readLevelMaps();
    const mapName = req.body.name;
    currentData[mapName] = [];
    writeLevelMaps(currentData);
    res.send({ message: "Data updated successfully", map: req.body });
  } catch (error) {
    res.status(500).send({ message: "Failed to update maps", error });
  }
});

//Add a new level to an existing map
app.post("/maps/:mapName", (req, res) => {
  try {
    let currentData = readLevelMaps();
    const mapName = req.params.mapName;
    currentData[mapName].push(req.body.name);
    writeLevelMaps(currentData);
    res.send({ message: "Data updated successfully", map: req.body });
  } catch (error) {
    res.status(500).send({ message: "Failed to update maps", error });
  }
});

app.put("/data", (req, res) => {
  try {
    let currentData = readData();
    currentData = { ...currentData, ...req.body };
    writeData(currentData);
    res.json({ message: "Data modified successfully" }); // Ensure JSON response
  } catch (error) {
    res.status(500).send({ message: "Failed to modify data", error });
  }
});

app.put("/maps", (req, res) => {
  try {
    let currentData = readLevelMaps();
    currentData = { ...currentData, ...req.body };
    writeLevelMaps(currentData);
    res.json({ message: "Data modified successfully", map: req.body }); // Ensure JSON response
  } catch (error) {
    res.status(500).send({ message: "Failed to modify maps", error });
  }
});

app.delete("/data", (req, res) => {
  try {
    writeData({});
    res.send({ message: "Data cleared successfully" });
  } catch (error) {
    res.status(500).send({ message: "Failed to clear data", error });
  }
});

app.delete("/maps", (req, res) => {
  try {
    writeLevelMaps({});
    res.send("Data cleared successfully");
  } catch (error) {
    res.status(500).send({ message: "Failed to clear data", error });
  }
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
