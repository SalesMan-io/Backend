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
  suppliers: [
    {
      shopifyId: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
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
        },
      ],
    },
  ],
});

export const Partner = mongoose.model("Partner", PartnerSchema);
