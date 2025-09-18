const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { uploadToMega } = require('./mega'); // MEGA module

const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// Admin config
// ====================
const JWT_SECRET = 'Sayura2008***7111s';
const ADMIN_USERNAME = 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('Sayura2008***7', 10);

// ====================
// Upload folder
// ====================
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ====================
// Multer setup
// ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ====================
// Express middleware
// ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const metaFile = path.join(uploadDir, 'meta.json');

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

  const entry = {
    file: req.file.filename,
    name: name || 'No Name',
    description: description || 'No Description',
    megaLink: null
  };
  meta.push(entry);
  writeMeta(meta);

  // MEGA upload
  try {
    const megaLink = await uploadToMega(req.file.filename);
    entry.megaLink = megaLink;
    writeMeta(meta); // save MEGA link
    console.log(`[MEGA] Uploaded: ${req.file.filename}`);
    res.json({ success: true, filePath: '/uploads/' + req.file.filename, megaLink });
  } catch (err) {
    console.error('[MEGA] Upload failed:', err);
    res.json({ success: true, filePath: '/uploads/' + req.file.filename, megaLink: null });
  }
});

// ====================
// Public gallery API
// ====================
app.get('/uploads', (req, res) => {
  res.json(readMeta());
});

// ====================
// Delete route
// ====================
app.delete('/uploads/:file', verifyToken, (req, res) => {
  const fileName = req.params.file;
  const meta = readMeta();
  const index = meta.findIndex(m => m.file === fileName);
  if (index === -1) return res.status(404).json({ error: 'File not found' });

  const filePath = path.join(uploadDir, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  meta.splice(index, 1);
  writeMeta(meta);
  res.json({ success: true });
});

// ====================
// Start server
// ====================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
