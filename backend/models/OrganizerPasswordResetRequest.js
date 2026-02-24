const mongoose = require("mongoose");

const organizerPasswordResetRequestSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    adminDecisionNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

organizerPasswordResetRequestSchema.index({ organizer: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("OrganizerPasswordResetRequest", organizerPasswordResetRequestSchema);
