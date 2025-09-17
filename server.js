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
    const storage = Mega({
      email: settings.MEGA_EMAIL,
      password: settings.MEGA_PASSWORD,
    });

    storage.on('error', (err) => {
      console.error('Mega login error:', err);
      return res.status(500).send('Mega login failed!');
    });

    storage.on('ready', async () => {
      try {
        const fileSize = fs.statSync(req.file.path).size;

        // Create the Mega upload file
        const file = storage.upload({
          name: req.file.originalname,
          size: fileSize,
        });

        // Pipe local file to Mega
        fs.createReadStream(req.file.path).pipe(file);

        file.on('complete', () => {
          // Delete local temp file
          fs.unlinkSync(req.file.path);

          // Generate Mega download link
          const megaLink = file.link(); // Use function to generate link
          res.send(
            `File uploaded successfully! <br>Mega Link: <a href="${megaLink}" target="_blank">${megaLink}</a>`
          );
        });

        file.on('error', (err) => {
          console.error('File upload error:', err);
          res.status(500).send('Upload failed!');
        });
      } catch (err) {
        console.error('Upload handling error:', err);
        res.status(500).send('Upload failed!');
      }
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).send('Upload failed!');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
