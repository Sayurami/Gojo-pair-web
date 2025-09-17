const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Mega = require('megajs');
require('dotenv').config();
const settings = require('./settings');

const app = express();
const PORT = settings.PORT || 3000;

// Multer temporary storage
const upload = multer({ dest: 'uploads/' });

// Serve HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload route
app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.send('No file uploaded!');

  try {
    // Mega login
    const storage = Mega({ email: settings.MEGA_EMAIL, password: settings.MEGA_PASSWORD });

    // Wait until Mega login is ready
    storage.on('ready', () => {
      const file = storage.upload({
        name: req.file.originalname,
        size: fs.statSync(req.file.path).size
      });

      const fileStream = fs.createReadStream(req.file.path);
      fileStream.pipe(file);

      // When upload is complete and link is ready
      file.on('ready', () => {
        fs.unlinkSync(req.file.path); // Delete temp file
        res.send(`File uploaded successfully! <br>Mega Link: <a href="${file.link()}" target="_blank">${file.link()}</a>`);
      });

      file.on('error', (err) => {
        console.error(err);
        res.status(500).send('Upload failed!');
      });
    });

    storage.on('error', (err) => {
      console.error(err);
      res.status(500).send('Mega login failed!');
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed!');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
