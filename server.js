const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadToMega } = require("./mega"); // Mega upload helper

const app = express();
const PORT = process.env.PORT || 3000;

// Public folder
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadDir)); // serve uploads
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

// Meta file
const metaFile = path.join(uploadDir, "meta.json");
function readMeta() {
  if (!fs.existsSync(metaFile)) return [];
  try { return JSON.parse(fs.readFileSync(metaFile, "utf-8")); }
  catch { return []; }
}
function writeMeta(data) {
  fs.writeFileSync(metaFile, JSON.stringify(data, null, 2));
}

// ✅ Multer storage with original extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const localFilePath = path.join(uploadDir, req.file.filename);
  let megaLink = null;

  try {
    // Upload to MEGA
    megaLink = await uploadToMega(req.file.originalname, fs.readFileSync(localFilePath));
  } catch (err) {
    console.error("Mega upload failed:", err);
  }

  // Save metadata
  const meta = readMeta();
  meta.push({
    filename: req.file.filename,       // now includes .jpg/.png etc
    originalName: req.file.originalname,
    megaLink
  });
  writeMeta(meta);

  res.json({
    success: true,
    localPath: "/uploads/" + req.file.filename,
    megaLink
  });
});

// List files
app.get("/uploads", (req, res) => {
  const meta = readMeta();
  res.json(meta);
});

// Delete route
app.delete("/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  const meta = readMeta();
  const index = meta.findIndex(f => f.filename === filename);
  if (index === -1) return res.status(404).json({ error: "File not found" });

  // delete local file
  const localPath = path.join(uploadDir, filename);
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

  meta.splice(index, 1);
  writeMeta(meta);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
