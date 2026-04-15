const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ message: "No token ❌" });
    }

    const decoded = jwt.verify(token, SECRET);

    req.user = decoded; // { id, role }

    next();

  } catch (err) {
    return res.status(401).json({ message: "Invalid token ❌" });
  }
};

module.exports = auth;