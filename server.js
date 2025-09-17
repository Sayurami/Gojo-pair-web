const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Import settings
const settings = require('./settings');

const app = express();
const PORT = settings.PORT || 3000;

// Cloudinary config
cloudinary.config({
  cloud_name: settings.CLOUDINARY_CLOUD_NAME,
  api_key: settings.CLOUDINARY_API_KEY,
  api_secret: settings.CLOUDINARY_API_SECRET
});

// Multer + Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif']
  }
});
const upload = multer({ storage });

// Serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload route
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.send('No file uploaded!');
  res.send(`File uploaded successfully! <br><img src="${req.file.path}" width="300">`);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
