const mongoose = require("mongoose");
const crypto = require("crypto");

const generateTicketId = () => {
  return `TKT-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

const ticketSchema = new mongoose.Schema(
  {
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    ticketId: {
      type: String,
      default: null,
    },
    qrPayload: {
      type: String,
      default: "",
    },
    qrCode: {
      type: String,
      default: "",
    },
    merchandiseOrder: {
      variant: {
        type: String,
        default: "",
      },
      size: {
        type: String,
        default: "",
      },
      color: {
        type: String,
        default: "",
      },
      quantity: {
        type: Number,
        default: 0,
      },
    },
    payment: {
      status: {
        type: String,
        enum: ["NotRequired", "Pending", "Approved", "Rejected"],
        default: "NotRequired",
      },
      proofUrl: {
        type: String,
        default: "",
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organizer",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      rejectionReason: {
        type: String,
        default: "",
      },
    },
    status: {
      type: String,
      enum: ["Pending", "Registered", "Rejected", "Cancelled"],
      default: "Registered",
      index: true,
    },
    teamName: {
      type: String,
      default: "",
      trim: true,
    },
    attended: {
      type: Boolean,
      default: false,
    },
    attendanceTime: {
      type: Date,
      default: null,
    },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer",
      default: null,
    },
    attendanceAudit: {
      type: [
        {
          actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organizer",
            required: true,
          },
          source: {
            type: String,
            enum: ["scan_qr", "manual_mark", "manual_override"],
            required: true,
          },
          previousAttended: {
            type: Boolean,
            required: true,
          },
          nextAttended: {
            type: Boolean,
            required: true,
          },
          note: {
            type: String,
            default: "",
          },
          changedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    formResponses: {
      type: [
        {
          label: {
            type: String,
            required: true,
            trim: true,
          },
          value: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

ticketSchema.index({ ticketId: 1 }, { unique: true, sparse: true });

ticketSchema.pre("validate", async function () {
  if (this.ticketId) {
    return;
  }

  // retry ticket id generation if collision happens
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateTicketId();
    const exists = await this.constructor.exists({ ticketId: candidate });
    if (!exists) {
      this.ticketId = candidate;
      return;
    }
  }
});

module.exports = mongoose.model("Ticket", ticketSchema);
