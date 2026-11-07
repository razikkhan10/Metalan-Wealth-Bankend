/**
 * models/Property.model.js
 * ------------------------------------------------------------------
 * Property Model
 * ------------------------------------------------------------------
 */

const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    // Property name — now the lookup key used by purchaseProperty()
    // (POST /api/properties/purchase identifies the property by
    // name, not by its Mongo _id) — so it must be unique, or two
    // properties with the same name would make that lookup ambiguous.
    propertyName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    // Property price
    propertyPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Property type
    propertyType: {
      type: String,
      required: true,
      trim: true,
    },

    // Property location
    location: {
      type: String,
      required: true,
      trim: true,
    },

    // Property description
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Main image
    propertyImage: {
      type: String,
      default: "",
    },

    // Multiple images
    images: [
      {
        name: {
          type: String,
          default: "",
          trim: true,
        },

        url: {
          type: String,
          default: "",
          trim: true,
        },
      },
    ],

    // Total monetary value of property
    totalPropertyCost: {
      type: Number,
      required: true,
      min: 0,
    },

    // Total FAIX tokens assigned to property
    totalFaixToken: {
      type: Number,
      required: true,
      min: 0,
    },

    // Remaining tokens available for purchase
    availableFaixToken: {
      type: Number,
      required: true,
      min: 0,
    },

    // Tokens already purchased by users
    soldFaixToken: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Property status
    status: {
      type: String,
      enum: [
        "Available",
        "Pending",
        "Sold",
        "Inactive",
      ],
      default: "Available",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Property",
  propertySchema
);
