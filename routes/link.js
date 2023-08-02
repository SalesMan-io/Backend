import express from "express";
import { Link } from "../models/Link.js";

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const { url } = req.body;
    const link = await Link.create({ url });
    return res.status(200).send(link);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/incrementClicks", async (req, res) => {
  try {
    const { id } = req.body;
    const ip = req.ip;
    var query = {
      _id: id,
      clicks: { $ne: ip },
    };
    await Link.updateOne(query, { $inc: { clicksCount: 1 } });
    await Link.updateOne(
      {
        _id: id,
      },
      {
        $addToSet: {
          clicks: ip,
        },
      },
      { multi: false, upsert: false }
    );
    const link = await Link.findById(id, { url: 1, clicksCount: 1 });
    return res.status(200).send(link);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const link = await Link.findById(id, { url: 1, clicksCount: 1 });
    return res.status(200).send(link);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

export default router;
