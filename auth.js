const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "Sayura2008***7111s";

function generateToken(user) {
  return jwt.sign({ username: user.username }, SECRET, { expiresIn: "1h" });
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ error: "No token provided" });

  jwt.verify(token.replace("Bearer ", ""), SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Unauthorized" });
    req.user = decoded;
    next();
  });
}

module.exports = { generateToken, verifyToken };
