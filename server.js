const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadToMega } = require("./mega"); // Mega upload helper

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Multer temp storage
const upload = multer({ dest: path.join(__dirname, "public", "uploads") });

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    // Upload to Mega
    const buffer = fs.readFileSync(req.file.path);
    const megaLink = await uploadToMega(req.file.originalname, buffer);

    // Remove temp file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, megaLink });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Mega upload failed" });
  }
});

// Optional: list uploads
app.get("/uploads", (req, res) => {
  fs.readdir(path.join(__dirname, "public", "uploads"), (err, files) => {
    if (err) return res.status(500).json({ error: "Failed to list uploads" });
    res.json(files);
  });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
