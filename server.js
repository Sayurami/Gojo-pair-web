const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 JWT & admin config
const JWT_SECRET = process.env.JWT_SECRET || 'Sayura2008***7111s';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Sayura2008***7', 10);

// 📂 Local upload path
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Metadata file
const metaFile = path.join(uploadDir, 'meta.json');

// Google Drive service account
const serviceAccount = {
  type: "service_account",
  project_id: "gojo-bacup",
  private_key_id: "ab1a26851356fc9672646010dcf445a61fa73604",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDmDPqbaLhTk7p+
...
-----END PRIVATE KEY-----\n`,
  client_email: "gojo-backup@gojo-bacup.iam.gserviceaccount.com",
  client_id: "115633924006712424420",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/gojo-backup@gojo-bacup.iam.gserviceaccount.com"
};

const folderId = '1hAve0c3_UjrJ7PEc3dDt4COUfsihfzmq'; // Google Drive folder ID

// Google Drive auth
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

// Express middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔑 Generate JWT
function generateToken(user) {
  return jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '2h' });
}

// 🛡 Verify JWT middleware
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

// 🌍 Public gallery view
app.get('/uploads/', (req, res) => {
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));
  res.json(meta);
});

// 🔒 Upload route (admin only)
app.post('/upload', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded!');
    const { name, description } = req.body;

    // Save metadata
    let meta = [];
    if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));
    meta.push({
      file: req.file.filename,
      name: name || 'No Name',
      description: description || 'No Description'
    });
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

    // Upload to Google Drive
    const fileMetadata = {
      name: req.file.filename,
      parents: [folderId]
    };
    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(path.join(uploadDir, req.file.filename))
    };
    await drive.files.create({ resource: fileMetadata, media: media, fields: 'id' });

    res.json({ success: true, filePath: '/uploads/' + req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed');
  }
});

// 🔒 Delete photo (admin only)
app.delete('/uploads/:file', verifyToken, async (req, res) => {
  try {
    const fileName = req.params.file;
    let meta = [];
    if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

    const index = meta.findIndex(m => m.file === fileName);
    if (index === -1) return res.status(404).send('File not found');

    // Delete local file
    const filePath = path.join(uploadDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Remove metadata
    meta.splice(index, 1);
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

    // Delete from Google Drive
    const driveFiles = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents`,
      fields: 'files(id, name)'
    });
    for (const file of driveFiles.data.files) {
      await drive.files.delete({ fileId: file.id });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Delete failed');
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
