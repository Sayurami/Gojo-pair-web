const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sayura';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sayura2008***7';

// Upload folder
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

// Verify admin middleware
function verifyAdmin(req, res, next) {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) next();
  else res.status(403).json({ success:false, message:'Unauthorized' });
}

// Admin login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if(username === ADMIN_USERNAME && password === ADMIN_PASSWORD)
    res.json({ success:true, message:'Login successful' });
  else res.status(401).json({ success:false, message:'Invalid username or password' });
});

// Admin upload
app.post('/upload', verifyAdmin, upload.single('photo'), (req, res) => {
  if(!req.file) return res.status(400).send('No file uploaded!');
  const { name, description } = req.body;

  let meta = [];
  if(fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  meta.push({ file:req.file.filename, name:name||'No Name', description:description||'No Description' });
  fs.writeFileSync(metaFile, JSON.stringify(meta,null,2));

  res.json({ success:true, filePath:'/uploads/'+req.file.filename });
});

// Admin delete
app.post('/delete', verifyAdmin, (req,res)=>{
  const { file } = req.body;
  if(!file) return res.status(400).send('File required');

  let meta = [];
  if(fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  const index = meta.findIndex(m=>m.file===file);
  if(index===-1) return res.status(404).send('File not found');

  const filePath = path.join(uploadDir, file);
  if(fs.existsSync(filePath)) fs.unlinkSync(filePath);

  meta.splice(index,1);
  fs.writeFileSync(metaFile, JSON.stringify(meta,null,2));

  res.json({ success:true, message:'File deleted' });
});

// Public gallery & download
app.get('/uploads/', (req,res)=>{
  let meta=[];
  if(fs.existsSync(metaFile)) meta=JSON.parse(fs.readFileSync(metaFile));
  res.json(meta);
});

app.get('/uploads/:file',(req,res)=>{
  const filePath = path.join(uploadDir, req.params.file);
  if(fs.existsSync(filePath)) res.download(filePath);
  else res.status(404).send('File not found');
});

app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
