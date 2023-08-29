import mongoose from "mongoose";

const PartnerSchema = new mongoose.Schema({
  /**************************************************************************
   *                           Partner Information                          *
   **************************************************************************/
  shopifyId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  noncompete: {
    type: Boolean,
    default: false,
  },
  products: [
    {
      shopifyId: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      discountPercent: {
        type: Number,
      },
      image: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      link: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Link",
      },
      description: {
        type: String,
      },
    },
  ],
  discountCode: {
    type: String,
  },
  supplierIds: [
    {
      type: String,
      required: true,
    },
  ],
});

export const Partner = mongoose.model("Partner", PartnerSchema);
