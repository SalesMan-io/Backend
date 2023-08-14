import mongoose from "mongoose";

const LinkSchema = new mongoose.Schema({
  /**************************************************************************
   *                           Link Information                          *
   **************************************************************************/
  url: {
    type: String,
    required: true,
    unique: true,
  },
  clicks: [
    {
      type: String,
    },
  ],
  clicksCount: {
    type: Number,
    default: 0,
  },
});

export const Link = mongoose.model("Link", LinkSchema);
