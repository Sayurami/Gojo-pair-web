const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metadata file
const metaFile = path.join(uploadDir, 'meta.json');

// Upload route
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded!');
  const { name, description } = req.body;

  // Save metadata
  let meta = [];
  if (fs.existsSync(metaFile)) {
    meta = JSON.parse(fs.readFileSync(metaFile));
  }
  meta.push({
    file: req.file.filename,
    name: name || 'No Name',
    description: description || 'No Description'
  });
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

// Return metadata for gallery
app.get('/uploads/', (req, res) => {
  let meta = [];
  if (fs.existsSync(metaFile)) {
    meta = JSON.parse(fs.readFileSync(metaFile));
  }
  res.json(meta);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
