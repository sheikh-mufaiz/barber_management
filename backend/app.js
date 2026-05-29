const express = require("express");
const cors = require("cors");

const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");

const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", bookingRoutes);
  app.use("/api", authRoutes);
  app.use("/api", serviceRoutes);

  app.get("/", (req, res) => {
    res.send("API is working 🚀");
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  return app;
};

module.exports = createApp;
