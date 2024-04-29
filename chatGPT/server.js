const express = require("express");
const cors = require("cors");

const app = express();
const router = require("./router.js");

const PORT = 3200;

app.use(cors());
app.use(express.json());

app.use("/", router);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
