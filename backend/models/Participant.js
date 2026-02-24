const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const participantSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      default: "participant",
    },
    institutionCategory: {
      type: String,
      enum: ["IIIT", "Non-IIIT"],
      required: true,
      default: "Non-IIIT",
    },
    participantType: {
      type: String,
      default: "Student",
      trim: true,
    },
    casVerified: {
      type: Boolean,
      default: false,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    contact: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    college: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    interests: {
      type: [String],
      default: [],
    },
    followedOrganizers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Organizer",
      default: [],
    },
  },
  { timestamps: true }
);

participantSchema.pre("validate", function () {
  const first = String(this.firstName || "").trim();
  const last = String(this.lastName || "").trim();
  this.firstName = first;
  this.lastName = last;
  this.name = `${first} ${last}`.trim();
});

participantSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  // hash password before save
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

participantSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Participant", participantSchema);
