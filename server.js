const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------
// 🔹 Config
// ------------------------
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const metaFile = path.join(uploadDir, 'meta.json');

// Google Drive setup
const KEY_FILE = path.join(__dirname, 'service-account.json'); // JSON key path
const FOLDER_ID = '1hAve0c3_UjrJ7PEc3dDt4COUfsihfzmq'; // Your folder ID

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// ------------------------
// 🔹 Multer storage
// ------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ------------------------
// 🔹 Express setup
// ------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------
// 🔹 Upload route
// ------------------------
app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded!');
  const { name, description } = req.body;

  // Save meta
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  meta.push({
    file: req.file.filename,
    name: name || 'No Name',
    description: description || 'No Description',
  });

  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  // Upload to Drive
  try {
    await drive.files.create({
      requestBody: {
        name: req.file.filename,
        parents: [FOLDER_ID],
      },
      media: {
        body: fs.createReadStream(path.join(uploadDir, req.file.filename)),
      },
    });
    console.log(`Uploaded ${req.file.filename} to Google Drive`);
  } catch (err) {
    console.error('Drive upload error:', err);
  }

  res.json({ success: true, filePath: '/uploads/' + req.file.filename });
});

// ------------------------
// 🔹 Public gallery
// ------------------------
app.get('/uploads/', (req, res) => {
  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));
  res.json(meta);
});

// ------------------------
// 🔹 Delete file
// ------------------------
app.delete('/uploads/:file', async (req, res) => {
  const fileName = req.params.file;

  let meta = [];
  if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  const index = meta.findIndex(m => m.file === fileName);
  if (index === -1) return res.status(404).send('File not found');

  // Remove file locally
  const filePath = path.join(uploadDir, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // Remove from Drive
  try {
    const driveList = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='${fileName}'`,
      fields: 'files(id, name)',
    });
    const files = driveList.data.files;
    for (const f of files) {
      await drive.files.delete({ fileId: f.id });
      console.log(`Deleted ${f.name} from Drive`);
    }
  } catch (err) {
    console.error('Drive delete error:', err);
  }

  // Remove metadata
  meta.splice(index, 1);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  res.json({ success: true });
});

// ------------------------
// 🔹 Sync from Drive on start
// ------------------------
async function syncFromDrive() {
  try {
    const driveList = await drive.files.list({
      q: `'${FOLDER_ID}' in parents`,
      fields: 'files(id, name)',
    });
    const files = driveList.data.files;

    for (const f of files) {
      const localPath = path.join(uploadDir, f.name);
      if (!fs.existsSync(localPath)) {
        const dest = fs.createWriteStream(localPath);
        await drive.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'stream' })
          .then(res => new Promise((resolve, reject) => {
            res.data
              .on('end', () => resolve())
              .on('error', err => reject(err))
              .pipe(dest);
          }));
        console.log(`Downloaded ${f.name} from Drive`);
      }
    }
  } catch (err) {
    console.error('Drive sync error:', err);
  }
}

// ------------------------
// 🔹 Start server
// ------------------------
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await syncFromDrive(); // Auto sync on start
});
