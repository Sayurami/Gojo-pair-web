const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Mega = require('megajs');
require('dotenv').config();
const settings = require('./settings');

const app = express();
const PORT = settings.PORT || 3000;

// ✅ Ensure uploads folder exists (Heroku restart issue fix)
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
      console.log('✅ Mega login success!');

      // ✅ Upload to Mega
      const file = storage.upload({
        name: req.file.originalname,
        size: fs.statSync(req.file.path).size
      });

      fs.createReadStream(req.file.path).pipe(file);

      file.on('complete', () => {
        console.log('✅ File uploaded to Mega');

        // ✅ Generate public link safely (async)
        file.link((err, link) => {
          fs.unlinkSync(req.file.path); // delete temp file

          if (err) {
            console.error('❌ Mega link generation failed:', err);
            return res.status(500).send('Link generation failed!');
          }

          console.log('🔗 Link:', link);
          res.send(`✅ File uploaded successfully!<br><a href="${link}" target="_blank">${link}</a>`);
        });
      });

      file.on('error', (err) => {
        console.error('❌ File upload failed:', err);
        res.status(500).send('Upload failed!');
      });
    });

    storage.on('error', (err) => {
      console.error('❌ Mega login failed:', err);
      res.status(500).send('Mega login failed! Check credentials.');
    });

  } catch (err) {
    console.error('❌ Unexpected server error:', err);
    res.status(500).send('Upload failed!');
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
