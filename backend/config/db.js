const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI || typeof process.env.MONGO_URI !== "string") {
    console.error("mongodb connection failed MONGO_URI is missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("mongodb connected");
  } catch (error) {
    console.error("mongodb connection failed", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
