const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin";
const ADMIN_NAME = "platform admin";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  await Admin.deleteMany({ email: { $ne: ADMIN_EMAIL } });

  let admin = await Admin.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    admin = await Admin.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin",
    });
  } else {
    admin.name = ADMIN_NAME;
    admin.password = ADMIN_PASSWORD;
    admin.role = "admin";
    await admin.save();
  }

  const count = await Admin.countDocuments();
  console.log(`admin provisioned: ${admin.email}, total admins: ${count}`);
  await mongoose.disconnect();
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("admin provisioning failed", error.message);
    process.exit(1);
  });
