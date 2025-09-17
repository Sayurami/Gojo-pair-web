const ADMIN_USERNAME = "sayuramihiranga4@gmail.com";
const ADMIN_PASSWORD = "Sayura2008***7";

// Simple verify middleware
function verifyAdmin(req, res, next){
  const { username, password } = req.body; // browser form POST username/password
  if(username === ADMIN_USERNAME && password === ADMIN_PASSWORD){
    next();
  } else {
    res.status(403).json({ success: false, message: "Unauthorized" });
  }
}

module.exports = { verifyAdmin };
