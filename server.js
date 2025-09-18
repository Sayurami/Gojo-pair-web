const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Storage } = require('megajs');
const settings = require('./setting');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin config
const JWT_SECRET = settings.JWT_SECRET;
const ADMIN_USERNAME = settings.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(settings.ADMIN_PASSWORD, 10);

// Upload paths
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const metaFile = path.join(uploadDir, 'meta.json');

// JWT
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

// Meta helper
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
  try { fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2)); }
  catch (err) { console.error(err); }
}

// Mega setup
const megaStorage = new Storage({
  email: settings.MEGA_EMAIL,
  password: settings.MEGA_PASSWORD
});
megaStorage.ready(() => console.log('Mega ready'));

// Routes
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: generateToken({ username }) });
});

app.post('/upload', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Mega upload
  const filePath = path.join(uploadDir, req.file.filename);
  const megaFile = megaStorage.upload({
    name: req.file.filename,
    size: fs.statSync(filePath).size
  });
  fs.createReadStream(filePath).pipe(megaFile);

  const meta = readMeta();
  meta.push({
    file: req.file.filename,
    name: req.body.name || 'No Name',
    description: req.body.description || 'No Description'
  });
  writeMeta(meta);

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
