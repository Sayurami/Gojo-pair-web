const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Secret key for admin
const SECRET_KEY = 'Sayura2008***7';

// Upload folder
const uploadDir = path.join(__dirname, 'public', 'uploads');
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive:true });

const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, uploadDir),
  filename: (req,file,cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended:true }));

const metaFile = path.join(uploadDir, 'meta.json');

// Admin upload
app.post('/upload', upload.single('photo'), (req,res)=>{
  if(req.query.key !== SECRET_KEY) return res.status(403).send('Unauthorized');

  if(!req.file) return res.status(400).send('No file uploaded!');
  const { name, description } = req.body;

  let meta = [];
  if(fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));

  meta.push({ file:req.file.filename, name:name||'No Name', description:description||'No Description' });
  fs.writeFileSync(metaFile, JSON.stringify(meta,null,2));

  res.json({ success:true, filePath:'/uploads/'+req.file.filename });
});

// Admin delete
app.post('/delete', (req,res)=>{
  if(req.query.key !== SECRET_KEY) return res.status(403).send('Unauthorized');

  const file = req.query.file;
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

// Public gallery
app.get('/uploads/', (req,res)=>{
  let meta=[];
  if(fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile));
  res.json(meta);
});

// Public file download
app.get('/uploads/:file',(req,res)=>{
  const filePath = path.join(uploadDir, req.params.file);
  if(fs.existsSync(filePath)) res.download(filePath);
  else res.status(404).send('File not found');
});

app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
