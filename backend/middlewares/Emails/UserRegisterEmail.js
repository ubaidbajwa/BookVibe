/**
 * @file User Registration & Authentication Emails
 * @description Handles sending various emails related to user registration, OTP verification, and password resets.
 */

// Section: Imports
import nodemailer from "nodemailer";

// Section: Helper Functions

/**
 * Creates a Nodemailer transporter using Gmail service.
 * @returns {Object} Transporter object.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MY_EMAIL,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

// Section: HTML Templates

/**
 * Generates the welcome email HTML.
 * @param {string} username - The name of the user.
 * @returns {string} HTML email template.
 */
const welcomeHtml = (username) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    @media only screen and (max-width:600px){
      .wrapper{padding:10px!important}.card{padding:20px!important}
      .title{font-size:20px!important}.paragraph{font-size:15px!important;line-height:1.5!important}
      .features{font-size:14px!important;line-height:1.6!important;padding:12px!important}
      .button{padding:12px 25px!important;font-size:14px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <div class="wrapper" style="font-family:Arial,sans-serif;padding:40px;background:#f4f4f4;">
    <div class="card" style="max-width:600px;margin:auto;background:#fff;padding:40px;border-radius:16px;border:1px solid #e0e0e0;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
      <h2 class="title" style="text-align:center;color:#4A00E0;font-size:28px;font-weight:300;margin-bottom:20px;">
        Welcome to BookVibe
      </h2>
      <p class="paragraph" style="font-size:18px;color:#555;line-height:1.7;margin-bottom:20px;">
        Hi <strong style="color:#4A00E0;">${username}</strong>,<br/><br/>
        Thank you for registering with <strong style="color:#4A00E0;">BookVibe</strong>!
        We're excited to have you join our community.
      </p>
      <div class="features" style="background:linear-gradient(135deg,#f9f9f9,#f0f0f0);padding:20px;border-left:5px solid #4A00E0;margin:30px 0;border-radius:8px;font-size:16px;color:#333;line-height:1.8;">
        <strong>Find your perfect stay</strong><br/>
        <strong>Explore accommodations with ease</strong><br/>
        <strong>Leave reviews and share your experience</strong>
      </div>
      <div style="text-align:center;margin:40px 0 20px;">
        <a class="button" href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display:inline-block;padding:15px 30px;background:linear-gradient(135deg,#4A00E0,#8E2DE2);color:white;text-decoration:none;border-radius:25px;font-size:16px;font-weight:500;">
          Explore BookVibe
        </a>
      </div>
      <hr style="margin:40px 0;border:none;border-top:1px solid #eee;"/>
      <p style="text-align:center;font-size:12px;color:#777;margin:0;">2025 BookVibe. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Generates the OTP verification email HTML.
 * @param {string} username - The name of the user.
 * @param {string} otp - The one-time password.
 * @returns {string} HTML email template.
 */
const otpHtml = (username, otp) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;padding:40px;border:1px solid #e0e0e0;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <h2 style="margin-top:0;text-align:center;color:#4A00E0;font-size:24px;font-weight:400;">
      BookVibe Email Verification
    </h2>
    <p style="color:#555;font-size:16px;line-height:1.7;">
      Hi <strong style="color:#4A00E0;">${username}</strong>,
    </p>
    <p style="color:#555;font-size:16px;line-height:1.7;">
      Use the code below to verify your email address.
      This code expires in <strong>10 minutes</strong>.
    </p>
    <div style="margin:32px 0;text-align:center;">
      <div style="display:inline-block;background:#f3f0ff;border:2px solid #7c3aed;border-radius:12px;padding:20px 40px;">
        <span style="font-size:42px;font-weight:700;letter-spacing:10px;color:#4A00E0;">${otp}</span>
      </div>
    </div>
    <p style="color:#888;font-size:14px;line-height:1.6;border-top:1px solid #eee;padding-top:20px;margin-top:10px;">
      If you did not request this code, please ignore this email.
    </p>
    <p style="text-align:center;font-size:12px;color:#aaa;margin-top:24px;">
      2025 BookVibe. All rights reserved.
    </p>
  </div>
</body>
</html>`;
};

/**
 * Generates the password reset email HTML.
 * @param {string} username - The name of the user.
 * @param {string} resetUrl - The URL to reset the password.
 * @returns {string} HTML email template.
 */
const resetHtml = (username, resetUrl) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
    <h2 style="margin-top:0;color:#4f46e5;">Reset your BookVibe password</h2>
    <p style="color:#4b5563;line-height:1.7;">
      Hi <strong>${username}</strong>, we received a request to reset your password.
    </p>
    <p style="color:#4b5563;line-height:1.7;">
      Click the button below. This link expires in <strong>15 minutes</strong>.
    </p>
    <div style="margin:28px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;">
        Reset Password
      </a>
    </div>
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:16px;">
      If you did not request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;

// Section: Exported Functions

/**
 * Sends a welcome email to a newly registered user.
 * @param {string} username - The user's name.
 * @param {string} emailTo - The recipient's email address.
 * @returns {Promise<void>}
 */
const sendUserRegistrationEmail = async (username, emailTo) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"BookVibe" <${process.env.MY_EMAIL}>`,
      to: emailTo,
      subject: 'Welcome to BookVibe',
      html: welcomeHtml(username),
    });
    console.log(`[Email] Welcome email sent to ${emailTo}`);
  } catch (error) {
    console.error('[Email] sendUserRegistrationEmail error:', error.message);
  }
};

/**
 * Sends an OTP verification email to a user.
 * @param {string} username - The user's name.
 * @param {string} emailTo - The recipient's email address.
 * @param {string} otp - The one-time password.
 * @returns {Promise<void>}
 */
const sendOTPEmail = async (username, emailTo, otp) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"BookVibe" <${process.env.MY_EMAIL}>`,
    to: emailTo,
    subject: `${otp} — your BookVibe verification code`,
    html: otpHtml(username, otp),
  });
  console.log(`[Email] OTP sent to ${emailTo}`);
};

/**
 * Sends a password reset email to a user.
 * @param {string} username - The user's name.
 * @param {string} emailTo - The recipient's email address.
 * @param {string} resetUrl - The password reset link.
 * @returns {Promise<void>}
 */
const sendPasswordResetEmail = async (username, emailTo, resetUrl) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"BookVibe" <${process.env.MY_EMAIL}>`,
    to: emailTo,
    subject: 'Reset your BookVibe password',
    html: resetHtml(username, resetUrl),
  });
  console.log(`[Email] Password reset sent to ${emailTo}`);
};

/**
 * Sends a verification rejection email.
 * @param {string} username
 * @param {string} emailTo
 * @param {string} reason
 */
const sendRejectionEmail = async (username, emailTo, reason) => {
  try {
    const transporter = createTransporter();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
    <h2 style="margin-top:0;color:#dc2626;">BookVibe — Verification Rejected</h2>
    <p style="color:#4b5563;line-height:1.7;">Hi <strong>${username}</strong>,</p>
    <p style="color:#4b5563;line-height:1.7;">
      Unfortunately your identity verification was <strong style="color:#dc2626;">rejected</strong> by our team.
    </p>
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:8px;margin:20px 0;">
      <p style="margin:0;color:#991b1b;font-size:14px;"><strong>Reason:</strong><br/>${reason || 'Documents were unclear or did not meet requirements.'}</p>
    </div>
    <p style="color:#4b5563;line-height:1.7;">
      You can log in and re-submit your documents with clearer images.
    </p>
    <div style="margin:28px 0;">
      <a href="${clientUrl}/resubmit-verification" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;">
        Re-submit Documents
      </a>
    </div>
    <p style="color:#9ca3af;font-size:13px;border-top:1px solid #f3f4f6;padding-top:16px;">
      If you believe this is an error, please contact our support team.
    </p>
    <p style="text-align:center;font-size:12px;color:#aaa;margin-top:24px;">2025 BookVibe. All rights reserved.</p>
  </div>
</body>
</html>`;
    await transporter.sendMail({
      from: `"BookVibe" <${process.env.MY_EMAIL}>`,
      to: emailTo,
      subject: 'BookVibe — Identity Verification Rejected',
      html,
    });
    console.log(`[Email] Rejection email sent to ${emailTo}`);
  } catch (error) {
    console.error('[Email] sendRejectionEmail error:', error.message);
  }
};

export {
  sendUserRegistrationEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendRejectionEmail,
};
