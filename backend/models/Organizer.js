const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const organizerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      default: "",
      trim: true,
    },
    discordWebhookUrl: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    adminVisiblePassword: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      enum: ["organizer"],
      default: "organizer",
      immutable: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    passwordResetHistory: {
      type: [
        {
          requestedAt: {
            type: Date,
            required: true,
          },
          resolvedAt: {
            type: Date,
            default: null,
          },
          status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            required: true,
          },
          reason: {
            type: String,
            required: true,
            trim: true,
          },
          resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            default: null,
          },
          requestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OrganizerPasswordResetRequest",
            required: true,
          },
          note: {
            type: String,
            default: "",
            trim: true,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

organizerSchema.pre("save", async function () {
  this.role = "organizer";
  this.email = this.contactEmail;

  if (!this.isModified("password")) {
    return;
  }

  if (this.password.startsWith("$2a$") || this.password.startsWith("$2b$")) {
    return;
  }

  // hash password before save
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

organizerSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Organizer", organizerSchema);
