const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Mega = require('megajs');
require('dotenv').config();
const settings = require('./settings');

const app = express();
const PORT = process.env.PORT || settings.PORT || 3000;

// ✅ Ensure uploads folder exists (important for Heroku)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer temporary storage
const upload = multer({ dest: uploadDir });

// Serve HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload route
app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.send('No file uploaded!');

  try {
    // ✅ Mega login
    const storage = Mega({ 
      email: settings.MEGA_EMAIL, 
      password: settings.MEGA_PASSWORD 
    });

    storage.on('ready', () => {
      // ✅ Start upload
      const file = storage.upload({
        name: req.file.originalname,
        size: fs.statSync(req.file.path).size
      });

      const fileStream = fs.createReadStream(req.file.path);
      fileStream.pipe(file);

      // ✅ Wait until file ready (important - not "complete")
      file.on('ready', () => {
        try {
          fs.unlinkSync(req.file.path); // delete temp file
        } catch (e) {
          console.warn("Temp file delete failed:", e);
        }

        const megaLink = file.link(); // ✅ Get shareable link
        res.send(`✅ File uploaded successfully! <br><br>Mega Link: <a href="${megaLink}" target="_blank">${megaLink}</a>`);
      });

      file.on('error', (err) => {
        console.error('File upload error:', err);
        res.status(500).send('Upload failed!');
      });
    });

    storage.on('error', (err) => {
      console.error('Mega login error:', err);
      res.status(500).send('Mega login failed! Check credentials in settings.js');
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).send('Upload failed!');
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
