require("dotenv").config();

const createApp = require("../app");
const { ensureRuntime } = require("../runtime");

const app = createApp();

module.exports = async (req, res) => {
  try {
    await ensureRuntime({ serverless: true });
    return app(req, res);
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message
    });
  }
};
