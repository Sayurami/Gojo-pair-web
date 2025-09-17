const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}

module.exports = {
  // Gojo MD Config
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "duc50ixrz",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "791349818611237",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "VfGhJkL12345MnOpQrSt",
  PORT: process.env.PORT || 3000
};
