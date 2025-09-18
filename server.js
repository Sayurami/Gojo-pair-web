const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadToMega } = require("./mega");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve public folder
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Multer temp storage
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const localFilePath = path.join(uploadDir, req.file.filename);
  let megaLink = null;

  try {
    megaLink = await uploadToMega(req.file.originalname, fs.readFileSync(localFilePath));
  } catch (err) {
    console.error("Mega upload failed:", err);
  }

  res.json({
    success: true,
    file: req.file.filename,
    localPath: "/uploads/" + req.file.filename,
    megaLink
  });
});

// List uploaded files (return file names)
app.get("/uploads", (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Failed to list uploads" });
    res.json(files);
  });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
