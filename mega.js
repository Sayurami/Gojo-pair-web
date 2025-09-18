const fs = require('fs');
const path = require('path');
const { Storage } = require('megajs');

const uploadDir = path.join(__dirname, 'public', 'uploads');
const backupDir = path.join(__dirname, 'public', 'uploads_backup');
const metaFile = path.join(uploadDir, 'meta.json');

// MEGA login
const megaStorage = new Storage({
  email: "nnarutouzumaki25000@gmail.com",
  password: "Sayura2008***8"
}, () => console.log("[MEGA] Logged in ✅"));

// Helper: read meta.json
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

// Helper: write meta.json
function writeMeta(meta) {
  try {
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.error('Error writing meta.json:', err);
  }
}

// 🔹 Function to handle MEGA upload
function uploadToMega(fileName) {
  return new Promise((resolve, reject) => {
    try {
      const sourcePath = path.join(uploadDir, fileName);
      const backupPath = path.join(backupDir, fileName);

      // 1️⃣ Local backup
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.copyFileSync(sourcePath, backupPath);
      console.log(`[BACKUP] File copied: ${fileName}`);

      // 2️⃣ Upload to MEGA
      const uploadStream = megaStorage.upload(fileName);
      const readStream = fs.createReadStream(sourcePath);
      readStream.pipe(uploadStream);

      uploadStream.on('complete', file => {
        console.log(`[MEGA] Uploaded: ${file.name}`);
        console.log(`[MEGA] Link: ${file.link}`);

        // Update meta.json
        const meta = readMeta();
        const entry = meta.find(m => m.file === fileName);
        if (entry) {
          entry.megaLink = file.link;
          writeMeta(meta);
        }
        resolve(file.link);
      });

      uploadStream.on('error', err => {
        console.error('[MEGA] Upload failed:', err);
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { uploadToMega };
