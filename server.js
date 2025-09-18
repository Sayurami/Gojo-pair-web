const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Mega = require("megajs");
require("dotenv").config();
const settings = require("./settings");

const app = express();
const PORT = process.env.PORT || settings.PORT || 3000;

// Multer temporary storage
const upload = multer({ dest: "uploads/" });

// Serve static HTML (public/index.html)
app.use(express.static(path.join(__dirname, "public")));

// Default route (fallback if index.html missing)
app.get("/", (req, res) => {
  res.send("🚀 Gojo Pair Web is running on Heroku!");
});

// Example upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded");

    // Mega setup
    const storage = new Mega.Storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASSWORD,
    });

    storage.on("ready", () => {
      const stream = fs.createReadStream(req.file.path);
      storage.upload(req.file.originalname, stream, (err, file) => {
        if (err) return res.status(500).send("Upload failed");
        res.send(`✅ File uploaded: ${file.downloadLink}`);
        fs.unlinkSync(req.file.path); // remove temp file
      });
    });
  } catch (err) {
    res.status(500).send("Server Error: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
