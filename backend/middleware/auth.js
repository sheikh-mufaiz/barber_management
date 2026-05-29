const jwt = require("jsonwebtoken");

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret-change-me";

const auth = (req, res, next) => {
  try {
    const header = req.header("Authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;

    if (!token) {
      return res.status(401).json({ error: "Authentication required", message: "No token provided" });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    req.user = decoded;

    next();

  } catch (err) {
    return res.status(401).json({ error: "Authentication required", message: "Invalid token" });
  }
};

module.exports = auth;
