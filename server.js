const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Config
const JWT_SECRET = process.env.JWT_SECRET || 'Sayura2008***7111s';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Sayura2008***7', 10);
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // Example: '1hAve0c3_UjrJ7PEc3dDt4COUfsihfzmq'

// 📂 Upload path
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

// 🟢 Google Drive setup
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

// 🔑 JWT helper
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

// 🔒 Upload route (Admin only + Drive)
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

  // Upload to Google Drive
  if (DRIVE_FOLDER_ID) {
    try {
      const fileMeta = { name: req.file.filename, parents: [DRIVE_FOLDER_ID] };
      const media = { mimeType: 'image/*', body: fs.createReadStream(path.join(uploadDir, req.file.filename)) };
      await drive.files.create({ requestBody: fileMeta, media });
    } catch (err) {
      console.error('Drive upload error:', err.message);
    }
  }

  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

// 🌍 Public route
app.get('/uploads/', (req, res) => {
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));
  res.json(meta);
});

// 🔒 Delete route (Admin only)
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

  // Optional: Delete from Drive (if needed)
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
