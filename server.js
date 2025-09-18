const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { uploadToMega } = require('./mega'); // MEGA module

const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// Admin config
// ====================
const JWT_SECRET = process.env.JWT_SECRET || 'Sayura2008***7111s';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Sayura2008***7', 10);

// ====================
// Multer memory storage (no local save)
// ====================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ====================
// Express middleware
// ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const metaFile = path.join(__dirname, 'meta.json');

// ====================
// JWT helpers
// ====================
function generateToken(user) {
  return jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '2h' });
}

function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token provided' });
  jwt.verify(token.replace('Bearer ', ''), JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.user = decoded;
    next();
  });
}

// ====================
// Meta helpers
// ====================
function readMeta() {
  try {
    if (!fs.existsSync(metaFile)) return [];
    const content = fs.readFileSync(metaFile, 'utf-8').trim();
    if (!content) return [];
    return JSON.parse(content);
  } catch (err) {
    console.error('[META] Read error:', err);
    return [];
  }
}

function writeMeta(meta) {
  try {
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.error('[META] Write error:', err);
  }
}

// ====================
// Admin login
// ====================
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = generateToken({ username });
  res.json({ token });
});

// ====================
// Upload route
// ====================
app.post('/upload', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded!' });

  const { name, description } = req.body;
  const meta = readMeta();

  try {
    // Upload buffer directly to MEGA
    const megaLink = await uploadToMega(req.file.originalname, req.file.buffer);

    const entry = {
      file: req.file.originalname,
      name: name || 'No Name',
      description: description || 'No Description',
      megaLink
    };
    meta.push(entry);
    writeMeta(meta);

    console.log(`[MEGA] Uploaded: ${req.file.originalname}`);
    res.json({ success: true, megaLink });
  } catch (err) {
    console.error('[MEGA] Upload failed:', err);
    res.status(500).json({ error: 'MEGA upload failed' });
  }
});

// ====================
// Public gallery API
// ====================
app.get('/uploads', (req, res) => {
  res.json(readMeta());
});

// ====================
// Delete route (only meta, no local file)
// ====================
app.delete('/uploads/:file', verifyToken, (req, res) => {
  const fileName = req.params.file;
  const meta = readMeta();
  const index = meta.findIndex(m => m.file === fileName);
  if (index === -1) return res.status(404).json({ error: 'File not found' });

  meta.splice(index, 1);
  writeMeta(meta);
  res.json({ success: true });
});

// ====================
// Start server
// ====================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
