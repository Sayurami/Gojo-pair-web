const { Storage } = require("megajs");

const email = process.env.MEGA_EMAIL || "nnarutouzumaki25000@gmail.com";
const password = process.env.MEGA_PASSWORD || "Sayura2008***8";

// Upload buffer to Mega and return public link
async function uploadToMega(fileName, buffer) {
  return new Promise((resolve, reject) => {
    const storage = new Storage({ email, password });

    storage.on("ready", () => {
      const upload = storage.upload(fileName, buffer, (err, file) => {
        if (err) return reject(err);

        file.link((err, url) => {
          if (err) return reject(err);
          resolve(url);
        });
      });
    });

    storage.on("error", (err) => reject(err));
  });
}

module.exports = { uploadToMega };
