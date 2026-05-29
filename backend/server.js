require("dotenv").config();
const createApp = require("./app");
const { ensureRuntime } = require("./runtime");

const app = createApp();
const PORT = Number(process.env.PORT || 5000);

ensureRuntime()
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
