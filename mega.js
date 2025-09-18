const fs = require('fs');
const path = require('path');
const { Storage } = require('megajs');

// ====================
// MEGA credentials
// ====================
const MEGA_EMAIL = 'nnarutouzumaki25000@gmail.com';
const MEGA_PASSWORD = 'Sayura2008***8';

// Login to MEGA
const storage = new Storage({
  email: MEGA_EMAIL,
  password: MEGA_PASSWORD
}, () => console.log('[MEGA] Logged in ✅'));

// ====================
// Upload function
// ====================
function uploadToMega(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, 'public', 'uploads', filename);
    if (!fs.existsSync(filePath)) return reject('File not found');

    const upload = storage.upload(filename);
    const readStream = fs.createReadStream(filePath);

    readStream.pipe(upload);

    upload.on('complete', file => {
      console.log(`[MEGA] Uploaded: ${filename}`);
      console.log(`[MEGA] Link: ${file.link}`);
      resolve(file.link); // return MEGA link
    });

    upload.on('error', err => {
      console.error('[MEGA] Upload error:', err);
      reject(err);
    });
  });
}

// Export
module.exports = { uploadToMega };
