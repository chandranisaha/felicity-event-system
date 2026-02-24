const mongoose = require("mongoose");

const formFieldSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "dropdown", "checkbox", "file"],
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    eventType: {
      type: String,
      enum: ["Normal", "Merchandise"],
      required: true,
    },
    eligibility: {
      type: String,
      required: true,
      trim: true,
    },
    registrationDeadline: {
      type: Date,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    registrationLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    registrationFee: {
      type: Number,
      required: true,
      min: 0,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer",
      required: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["Draft", "Published", "Closed"],
      default: "Draft",
      index: true,
    },
    manualEventStatus: {
      type: String,
      enum: ["Upcoming", "Ongoing", "Completed", null],
      default: null,
    },
    merchandiseConfig: {
      variants: {
        type: [
          {
            name: {
              type: String,
              required: true,
              trim: true,
            },
            sizeMode: {
              type: String,
              enum: ["ONE_SIZE", "S_XL", "XS_XXL", "S_XXL", "CUSTOM"],
              default: "ONE_SIZE",
              trim: true,
            },
            sizes: {
              type: [String],
              default: [],
            },
            colors: {
              type: [String],
              default: [],
            },
            stock: {
              type: Number,
              required: true,
              min: 0,
            },
            remainingStock: {
              type: Number,
              required: true,
              min: 0,
            },
          },
        ],
        default: [],
      },
      purchaseLimitPerUser: {
        type: Number,
        default: 1,
        min: 1,
      },
      allowCancellation: {
        type: Boolean,
        default: false,
      },
    },
    formFields: {
      type: [formFieldSchema],
      default: [],
      validate: {
        validator: function (fields) {
          if (this.eventType !== "Normal") {
            return !fields || fields.length === 0;
          }
          return true;
        },
        message: "formFields are allowed only for Normal events",
      },
    },
  },
  { timestamps: true }
);

eventSchema.index({ organizer: 1, createdAt: -1 });

eventSchema.pre("validate", async function () {
  if (this.eventType !== "Merchandise") {
    if (
      this.merchandiseConfig &&
      Array.isArray(this.merchandiseConfig.variants) &&
      this.merchandiseConfig.variants.length > 0
    ) {
      throw new Error("merchandiseConfig is allowed only for Merchandise events");
    }
    this.merchandiseConfig = {
      variants: [],
      purchaseLimitPerUser: 1,
      allowCancellation: false,
    };
  } else {
    if (!this.merchandiseConfig || !Array.isArray(this.merchandiseConfig.variants) || this.merchandiseConfig.variants.length === 0) {
      throw new Error("Merchandise events must include at least one variant");
    }

    for (const variant of this.merchandiseConfig.variants) {
      if (variant.remainingStock > variant.stock) {
        throw new Error("remainingStock cannot exceed stock");
      }
    }
  }
});

module.exports = mongoose.model("Event", eventSchema);
