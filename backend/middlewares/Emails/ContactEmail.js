/**
 * @file Contact Form Email
 * @description Sends contact-form submissions from the public "Contact Us" page
 * to the BookVibe support inbox (MY_EMAIL). The sender's address is set as
 * replyTo so support can reply to the user directly.
 */

import nodemailer from "nodemailer";

/**
 * Creates a Nodemailer transporter using Gmail service.
 * @returns {Object} Transporter object.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MY_EMAIL,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

/**
 * Sends a contact-form submission to the support inbox.
 * Throws on failure so the controller can surface an error to the user.
 *
 * @param {Object} params - The submission details.
 * @param {string} params.name - Sender's name.
 * @param {string} params.email - Sender's email (used as replyTo).
 * @param {string} params.message - The message body.
 * @returns {Promise<void>}
 */
const sendContactEmail = async ({ name, email, message }) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"BookVibe Contact" <${process.env.MY_EMAIL}>`,
    to: process.env.MY_EMAIL,
    replyTo: email,
    subject: `New contact message from ${name}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:30px">
      <span style="font-size:24px;font-weight:bold;color:#F5F0E8">Book<span style="color:#C9A84C">Vibe</span></span>
    </div>
    <div style="background:#1A1A1F;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px">
      <h1 style="color:#F5F0E8;font-size:20px;margin:0 0 16px">New Contact Message</h1>
      <p style="color:#9A958E;font-size:13px;margin:0 0 6px"><strong style="color:#F5F0E8">Name:</strong> ${name}</p>
      <p style="color:#9A958E;font-size:13px;margin:0 0 16px"><strong style="color:#F5F0E8">Email:</strong> ${email}</p>
      <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:12px;padding:20px">
        <p style="color:#F5F0E8;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap">${message}</p>
      </div>
    </div>
    <p style="text-align:center;color:#5C5850;font-size:11px;margin-top:30px">© ${new Date().getFullYear()} BookVibe</p>
  </div>
</body>
</html>`,
  });
};

export { sendContactEmail };
