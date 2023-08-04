import twilio from "twilio";
import dotenv from "dotenv";
import { MailService } from "@sendgrid/mail";

const sgMail = new MailService();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
// const { MessagingResponse } = require('twilio').twiml;

const sendText = async (to, body) => {
  try {
    const result = await client.messages.create({
      body: body,
      from: "+16304071061",
      to: to,
    });
  } catch (err) {
    console.log(err);
  }
  return;
};

const sendEmail = async () => {
  try {
    const msg = {
      to: "23zhankanghong@berkeley.edu", // Change to your recipient
      from: "hugozhan0802@gmail.com", // Change to your verified sender
      subject: "https://frontend-magnetic-ai.vercel.app/link/64cc4a226a86d280039e66a6",
      text: "https://frontend-magnetic-ai.vercel.app/link/64cc4a226a86d280039e66a6",
      html: "<strong>https://frontend-magnetic-ai.vercel.app/link/64cc4a226a86d280039e66a6</strong>",
    };
    return await sgMail.send(msg);
  } catch (err) {
    console.log(err);
  }
  return;
};

export { sendText, sendEmail };
