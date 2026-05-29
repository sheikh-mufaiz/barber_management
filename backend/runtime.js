const mongoose = require("mongoose");
const { recalculateAllQueues } = require("./utils/scheduler");
const { backfillLegacyBookingSnapshots } = require("./utils/bookingSnapshots");

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
let startupPromise = null;
let backgroundStarted = false;

const validateEnv = () => {
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  }
};

const ensureDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  const backfillResult = await backfillLegacyBookingSnapshots();
  console.log(`Booking snapshot backfill complete: ${backfillResult.updated} updated`);
};

const startBackgroundJobs = () => {
  if (backgroundStarted) {
    return;
  }

  backgroundStarted = true;

  setInterval(async () => {
    try {
      await recalculateAllQueues();
      console.log("Queues auto-adjusted per barber");
    } catch (err) {
      console.log("Auto delay error:", err.message);
    }
  }, 60000);
};

const ensureRuntime = async ({ serverless = false } = {}) => {
  if (!startupPromise) {
    startupPromise = (async () => {
      validateEnv();
      await ensureDatabase();

      if (!serverless) {
        startBackgroundJobs();
      }
    })().catch((error) => {
      startupPromise = null;
      throw error;
    });
  }

  return startupPromise;
};

module.exports = {
  ensureRuntime
};
