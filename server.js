const express = require('express');
const multer = require('multer');
const path = require('path');
const { storage } = require('node-mega');
const settings = require('./settings');

const app = express();
const PORT = settings.PORT;

// Mega storage setup
const mega = storage();

// Multer for temp file storage
const upload = multer({ dest: 'uploads/' });

// Serve HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload route
app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.send('No file uploaded!');

  try {
    await mega.login(settings.MEGA_EMAIL, settings.MEGA_PASSWORD);
    const uploaded = await mega.upload(req.file.originalname, req.file.path);

    res.send(`File uploaded successfully! <br>Mega Link: <a href="${uploaded.url}" target="_blank">${uploaded.url}</a>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed!');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
