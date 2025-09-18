// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Admin & JWT Config
const JWT_SECRET = process.env.JWT_SECRET || 'Sayura2008***7111s';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Sayura2008***7', 10);

// 📂 Local upload path
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

// 🟢 Admin login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = generateToken({ username });
  res.json({ token });
});

// ---------------- Google Drive Setup ----------------
const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE'; // replace with your folder ID
const serviceAccount = JSON.parse(fs.readFileSync('service-account.json')); // your JSON key
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

// Upload to Google Drive
async function uploadToDrive(filePath, fileName) {
  const fileMetadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID]
  };
  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(filePath)
  };
  const res = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
  return res.data.id;
}

// Delete from Google Drive
async function deleteFromDrive(fileName) {
  const list = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and name='${fileName}' and trashed=false`,
    fields: 'files(id, name)'
  });
  if (list.data.files.length > 0) {
    await drive.files.delete({ fileId: list.data.files[0].id });
  }
}

// Sync Drive folder to local
async function syncDriveToLocal() {
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)'
  });
  for (const file of res.data.files) {
    const localPath = path.join(uploadDir, file.name);
    if (!fs.existsSync(localPath)) {
      const dest = fs.createWriteStream(localPath);
      const driveRes = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
      await new Promise((resolve, reject) => {
        driveRes.data
          .on('end', resolve)
          .on('error', reject)
          .pipe(dest);
      });
    }
  }
}

// ---------------- Routes ----------------

// 🔒 Admin upload
app.post('/upload', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded!');
  const { name, description } = req.body;

  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  meta.push({
    file: req.file.filename,
    name: name || 'No Name',
    description: description || 'No Description'
  });
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  try {
    await uploadToDrive(path.join(uploadDir, req.file.filename), req.file.filename);
  } catch (err) {
    console.error('Drive upload error:', err);
  }

  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

// 🌍 Public gallery
app.get('/uploads/', (req, res) => {
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));
  res.json(meta);
});

// 🔒 Admin delete
app.delete('/uploads/:file', verifyToken, async (req, res) => {
  const fileName = req.params.file;
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  const index = meta.findIndex(m => m.file === fileName);
  if (index === -1) return res.status(404).send('File not found');

  const filePath = path.join(uploadDir, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  meta.splice(index, 1);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  try { await deleteFromDrive(fileName); } catch (err) { console.error('Drive delete error:', err); }

  res.json({ success: true });
});

// ---------------- Start server ----------------
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await syncDriveToLocal();
    console.log('Drive sync complete.');
  } catch (err) {
    console.error('Drive sync failed:', err);
  }
});
