const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Mega = require('megajs');
const { email: MEGA_EMAIL, password: MEGA_PASSWORD } = require('./mega'); // 🔹 import mega credentials

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Config
const JWT_SECRET = process.env.JWT_SECRET || 'Sayura2008***7111s';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Sayura2008***7', 10);

// 📂 Upload path
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const metaFile = path.join(uploadDir, 'meta.json');

// 🔑 JWT generation
function generateToken(user) {
  return jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '2h' });
}

// 🛡 JWT verification middleware
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token.replace('Bearer ', ''), JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.user = decoded;
    next();
  });
}

// Helper: safely read meta.json
function readMeta() {
  try {
    if (!fs.existsSync(metaFile)) return [];
    const content = fs.readFileSync(metaFile, 'utf-8').trim();
    if (!content) return [];
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading meta.json:', err);
    return [];
  }
}

// Helper: safely write meta.json
function writeMeta(meta) {
  try {
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.error('Error writing meta.json:', err);
  }
}

// 🔹 Mega upload function
async function uploadToMega(filePath, fileName) {
  return new Promise((resolve, reject) => {
    const storage = Mega({ email: MEGA_EMAIL, password: MEGA_PASSWORD }, (err, account) => {
      if (err) return reject(err);

      const fileStream = fs.createReadStream(filePath);
      const uploadFile = account.upload({ name: fileName }, fileStream);

      uploadFile.complete.then(node => {
        node.link().then(link => resolve(link)).catch(reject);
      }).catch(reject);
    });
  });
}

// 🟢 Admin login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = generateToken({ username });
  res.json({ token });
});

// 🔒 Admin upload (Local + Auto Mega)
app.post('/upload', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded!' });

  const { name, description } = req.body;
  const meta = readMeta();

  const newMeta = {
    file: req.file.filename,
    name: name || 'No Name',
    description: description || 'No Description',
    megaLink: null
  };

  // ✅ Local upload + Mega auto upload
  try {
    const megaUrl = await uploadToMega(path.join(uploadDir, req.file.filename), req.file.filename);
    newMeta.megaLink = megaUrl;
  } catch (err) {
    console.error('Mega upload failed:', err);
    return res.status(500).json({ error: 'Mega upload failed' });
  }

  meta.push(newMeta);
  writeMeta(meta);

  res.json({ success: true, filePath: '/uploads/' + req.file.filename, megaLink: newMeta.megaLink });
});

// 🌍 Public gallery
app.get('/uploads/', (req, res) => {
  const meta = readMeta();
  res.json(meta);
});

// 🔒 Admin delete
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
