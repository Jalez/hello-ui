const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const cors = require("cors");
const app = express();
const PORT = 3000;
const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI();

// TODO:
// - Validation
// - Authentication (for creator, etc.) (username & password + JWT & cookie)
// - maps: canUseAI (true/false)
// - levels: remove UI only properties
// - randomization: select maps randomly

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

app.get("/levels", (req, res) => {
  res.json(readData());
});

app.get("/levels/:mapName", (req, res) => {
  const mapName = req.params.mapName;
  // if its "all", return all levels
  if (mapName === "all") {
    return res.json(readData());
  }
  const maps = readLevelMaps();
  if (!maps[mapName]) {
    return res.status(404).send({ message: "Map not found" });
  }
  const levelNames = maps[mapName].levels;
  const data = readData();
  const levelsData = levelNames.map((levelName) => data[levelName]);
  console.log("levelsData", levelsData[0].name);
  res.json(levelsData);
});

//Get all level names
app.get("/levels/names", async (req, res) => {
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
    const mapName = req.params.name;
    const maps = readLevelMaps();
    if (!maps[mapName]) {
      return res.status(404).send({ message: "Map not found" });
    }
    res.json(maps[mapName]);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch data", error });
  }
});

app.put("/levels/:id", (req, res) => {
  // FIXME: Implement properly
  try {
    console.log("POST");
    console.log("req.body", req.body);
    writeData(req.body);
    res.send({ message: "Data updated successfully", data: req.body });
  } catch (error) {
    res.status(500).send({ message: "Failed to update data", error });
  }
});
//Add an endpoint to update an existing maps randomization and canUseAI properties
app.put("/maps/:name", (req, res) => {
  try {
    let currentData = readLevelMaps();
    const mapName = req.params.name;
    if (!currentData[mapName]) {
      return res.status(404).send({ message: "Map not found" });
    }
    currentData[mapName] = { ...currentData[mapName], ...req.body };
    writeLevelMaps(currentData);
    res.send({
      message: "Data updated successfully",
      map: currentData[mapName],
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to update maps", error });
  }
});

// Add new map
app.post("/maps", (req, res) => {
  try {
    let currentData = readLevelMaps();
    const mapName = req.body.name;
    if (currentData[mapName]) {
      return res.status(400).send({ message: "Map already exists" });
    }
    // Add new map with structure conforming to the new format
    currentData[mapName] = {
      levels: [],
      canUseAI: false, // default false, can be overwritten by request body
      random: 0, // default 0, can be overwritten by request body
    };
    writeLevelMaps(currentData);
    res.send({
      message: "New map added successfully",
      map: currentData[mapName],
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to update maps", error });
  }
});

//Add a new level to an existing map
app.post("/maps/:mapName", (req, res) => {
  try {
    let currentData = readLevelMaps();
    const mapName = req.params.mapName;
    if (!currentData[mapName]) {
      return res.status(404).send({ message: "Map not found" });
    }
    if (currentData[mapName].levels.includes(req.body.name)) {
      return res.status(400).send({ message: "Level already exists" });
    }
    currentData[mapName].levels.push(req.body.name);
    writeLevelMaps(currentData);
    console.log("req.body", req.body);
    res.send({
      message: "Data updated successfully",
      map: currentData[mapName],
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to update maps", error });
  }
});

app.post("/levels", (req, res) => {
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
  // FIXME: Validate data
  try {
    let currentData = readLevelMaps();
    currentData = { ...currentData, ...req.body };
    writeLevelMaps(currentData);
    res.json({ message: "Data modified successfully", map: req.body }); // Ensure JSON response
  } catch (error) {
    res.status(500).send({ message: "Failed to modify maps", error });
  }
});

app.delete("/levels/:id", (req, res) => {
  // FIXME: level only one level at a time
  try {
    writeData({});
    res.send({ message: "Data cleared successfully" });
  } catch (error) {
    res.status(500).send({ message: "Failed to clear data", error });
  }
});

app.delete("/maps/:name", (req, res) => {
  // FIXME: delete only one level at a time
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
