const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Mega = require('megajs');
require('dotenv').config();
const settings = require('./settings');

const app = express();
const PORT = settings.PORT;

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

    const fileStream = fs.createReadStream(req.file.path);
    const fileStat = fs.statSync(req.file.path);

    const file = storage.upload({
      name: req.file.originalname,
      size: fileStat.size
    });

    fileStream.pipe(file);

    file.on('complete', () => {
      // Delete temp file
      fs.unlinkSync(req.file.path);
      res.send(`File uploaded successfully! <br>Mega Link: <a href="${file.downloadLink}" target="_blank">${file.downloadLink}</a>`);
    });

    file.on('error', (err) => {
      console.error(err);
      res.status(500).send('Upload failed!');
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed!');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
