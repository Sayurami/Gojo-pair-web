const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // unique name
  }
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));

// Upload route
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded!');
  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

// Route to return uploaded files list
app.get('/uploads/', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.json([]);
    // Only send image files (filter)
    const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    res.json(images);
  });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
