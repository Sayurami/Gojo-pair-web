// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Mega = require('megajs');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Config
const JWT_SECRET = 'Sayura2008***7111s';
const ADMIN_USERNAME = 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('Sayura2008***7', 10);

// 📂 Upload path
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const metaFile = path.join(uploadDir, 'meta.json');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT helpers
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

// Meta helpers
function readMeta() {
  try {
    if (!fs.existsSync(metaFile)) return [];
    const content = fs.readFileSync(metaFile, 'utf-8').trim();
    if (!content) return [];
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeMeta(meta) {
  try { fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2)); } catch {}
}

// Mega async upload
function uploadToMegaSafe(localPath) {
  try {
    const storage = new Mega.Storage({
      email: 'nnarutouzumaki25000@gmail.com',
      password: 'Sayura2008***8'
    });

    storage.on('ready', () => {
      const file = storage.upload({ name: path.basename(localPath) }, fs.createReadStream(localPath));
      file.on('complete', () => console.log('Mega uploaded:', localPath));
      file.on('error', (err) => console.error('Mega upload error:', err));
    });

    storage.on('error', (err) => console.error('Mega storage error:', err));
  } catch (err) {
    console.error('Mega upload failed:', err);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = generateToken({ username });
  res.json({ token });
});

app.post('/upload', verifyToken, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded!' });

  const { name, description } = req.body;
  const meta = readMeta();

  meta.push({
    file: req.file.filename,
    name: name || 'No Name',
    description: description || 'No Description'
  });

  writeMeta(meta);

  // Async Mega upload
  setImmediate(() => uploadToMegaSafe(path.join(uploadDir, req.file.filename)));

  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

app.get('/uploads', (req, res) => res.json(readMeta()));

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
