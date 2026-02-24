const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      required: true,
      trim: true,
    },
    users: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
  },
  { _id: false }
);

const forumMessageSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    authorRole: {
      type: String,
      enum: ["participant", "organizer", "admin"],
      required: true,
    },
    participantAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      default: null,
    },
    organizerAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer",
      default: null,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ForumMessage",
      default: null,
      index: true,
    },
    isAnnouncement: {
      type: Boolean,
      default: false,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    attachments: {
      type: [String],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

forumMessageSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("ForumMessage", forumMessageSchema);
