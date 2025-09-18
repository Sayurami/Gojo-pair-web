process.env.NODE_OPTIONS = '--openssl-legacy-provider';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Admin credentials
const JWT_SECRET = process.env.JWT_SECRET || 'Sayura2008***7111s';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Sayura2008***7', 10);

// 📂 Local storage path
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 📦 Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 🌐 Middleware
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

// 🟢 Login route
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

// 🏠 Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔒 Google Drive config
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const KEYFILE = path.join(__dirname, 'service-account.json'); // Google service account JSON

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILE,
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

// 🔒 Upload route (Admin)
app.post('/upload', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded!');
  const { name, description } = req.body;

  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  // add to local meta
  const fileMeta = {
    file: req.file.filename,
    name: name || 'No Name',
    description: description || 'No Description'
  };
  meta.push(fileMeta);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  // upload to Google Drive
  try {
    const gfile = await drive.files.create({
      requestBody: {
        name: req.file.filename,
        parents: [process.env.GDRIVE_FOLDER_ID], // folder ID in your Drive
      },
      media: {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(path.join(uploadDir, req.file.filename)),
      },
    });
    console.log('Uploaded to Drive:', gfile.data.id);
  } catch (err) {
    console.error('Google Drive upload error:', err);
  }

  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

// 🔒 Delete route (Admin)
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
