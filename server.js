process.env.NODE_OPTIONS = '--openssl-legacy-provider';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Mega = require('megajs');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Admin credentials
const JWT_SECRET = process.env.JWT_SECRET || 'Sayura2008***8';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Sayura2008***8', 10);

// 📂 Local storage
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const metaFile = path.join(uploadDir, 'meta.json');

// 🔑 JWT helpers
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

// 🟢 Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = generateToken({ username });
  res.json({ token });
});

// 🌍 Public gallery
app.get('/uploads/', (req, res) => {
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));
  res.json(meta);
});

// 🔒 Upload (Admin + Mega backup)
app.post('/upload', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded!');
  const { name, description } = req.body;

  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  const fileMeta = { file: req.file.filename, name: name || 'No Name', description: description || 'No Description' };
  meta.push(fileMeta);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  // Mega upload
  try {
    const storage = new Mega.Storage({
      email: process.env.MEGA_EMAIL || 'nnarutouzumaki25000@gmail.com',
      password: process.env.MEGA_PASSWORD || 'Sayura2008***8'
    });
    const file = storage.upload({
      name: req.file.filename,
      localPath: path.join(uploadDir, req.file.filename)
    });
    file.on('complete', () => console.log('Uploaded to Mega:', req.file.filename));
  } catch (err) {
    console.error('Mega upload error:', err);
  }

  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

// 🔒 Delete (Admin)
app.delete('/uploads/:file', verifyToken, (req, res) => {
  const fileName = req.params.file;
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  const index = meta.findIndex(m => m.file === fileName);
  if (index === -1) return res.status(404).send('File not found');

  const filePath = path.join(uploadDir, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  meta.splice(index, 1);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
