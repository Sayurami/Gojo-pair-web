const express = require("express");
const multer = require("multer");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads folder if not exists
const fs = require("fs");
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Serve HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Upload route
app.post("/upload", upload.single("photo"), (req, res) => {
  if (!req.file) return res.send("No file uploaded!");
  res.send(`File uploaded successfully! <br>
            <img src="/uploads/${req.file.filename}" width="300">`);
});

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
