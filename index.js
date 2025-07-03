const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

const server = require('./qr');
const code = require('./pair');

require('events').EventEmitter.defaultMaxListeners = 500;

// Body parser මුලින්ම දැමු
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.use('/server', server);
app.use('/code', code);

// HTML Routes
app.get('/pair', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'pair.html'));
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'qr.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'main.html'));
});

// Server Start
app.listen(PORT, () => {
    console.log(`
⭐ Don't forget to give a star!

🚀 Server running on http://localhost:${PORT}
    `);
});

module.exports = app;