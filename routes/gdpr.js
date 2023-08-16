import express from "express";
import { Link } from "../models/Link.js";
import { sendEmail } from "../utils/twilio.js";

const router = express.Router();

router.post("/customers/data_request", async (req, res) => {
  try {
    await sendEmail("Customer Data Request", JSON.stringify(req.body));
    return res.status(200).send();
  } catch (error) {
    console.log("link/bruh: ", error);
    return res.status(400).send(error);
  }
});

router.post("/customers/redact", async (req, res) => {
  try {
    await sendEmail("Customer Data Redact", JSON.stringify(req.body));
    return res.status(200).send();
  } catch (error) {
    console.log("link/bruh: ", error);
    return res.status(400).send(error);
  }
});

router.post("/shop/redact", async (req, res) => {
  try {
    await sendEmail("Shop Data Redact", JSON.stringify(req.body));
    return res.status(200).send();
  } catch (error) {
    console.log("link/bruh: ", error);
    return res.status(400).send(error);
  }
});

export default router;
