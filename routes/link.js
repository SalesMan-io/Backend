import express from "express";
import { Link } from "../models/Link.js";
import { sendEmail } from "../utils/twilio.js";

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const { url } = req.body;
    const link = await Link.create({ url });
    return res.status(200).send(link);
  } catch (error) {
    console.log("link/create: ", error);
    return res.status(400).send(error);
  }
});

router.post("/incrementClicks", async (req, res) => {
  try {
    const { id, customerId } = req.body;
    await Link.updateOne(
      {
        _id: id,
      },
      {
        $addToSet: {
          clicks: customerId,
        },
        $inc: { clicksCount: 1 },
      },
      { multi: false, upsert: false }
    );
    const link = await Link.findById(id, { url: 1, clicksCount: 1 });
    return res.status(200).send(link);
  } catch (error) {
    console.log("link/incrementClicks: ", error);
    return res.status(400).send(error);
  }
});

router.post("/bruh", async (req, res) => {
  try {
    const result = await sendEmail();
    return res.status(200).send(result);
  } catch (error) {
    console.log("link/bruh: ", error);
    return res.status(400).send(error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let link = await Link.findById(id);
    link.uniqueClicks = link.clicks.length;
    return res.status(200).send(link);
  } catch (error) {
    console.log("link/:id: ", error);
    return res.status(400).send(error);
  }
});

export default router;
