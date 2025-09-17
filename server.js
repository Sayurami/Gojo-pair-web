const express = require('express');
const multer = require('multer');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: '<ma-a-94b9e>.appspot.com'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload photo
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded!');
    const { name, description } = req.body;

    const fileName = Date.now() + path.extname(req.file.originalname);
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, { contentType: req.file.mimetype });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });

    await db.collection('photos').add({
      name: name || 'No Name',
      description: description || 'No Description',
      fileName,
      url,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed!');
  }
});

// Fetch gallery
app.get('/uploads', async (req, res) => {
  const snapshot = await db.collection('photos').orderBy('createdAt', 'desc').get();
  const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(photos);
});

// Delete photo
app.delete('/uploads/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const docRef = db.collection('photos').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Photo not found');

    const { fileName } = doc.data();
    await bucket.file(fileName).delete();
    await docRef.delete();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Delete failed!');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
