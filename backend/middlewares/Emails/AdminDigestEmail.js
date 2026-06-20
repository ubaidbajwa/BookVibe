/**
 * @file Admin Daily Digest Email
 * @description Generates and sends the daily platform-activity summary email to
 * admins who have settings.notifications.emailDigest enabled.
 */

import nodemailer from "nodemailer";

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MY_EMAIL,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

/**
 * Generates the daily digest email HTML.
 * @param {string} username - The admin's name.
 * @param {Object} stats - Aggregated platform stats for the period.
 * @returns {string} HTML email template.
 */
const digestHtml = (username, stats) => {
  const row = (label, value) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #2a2a30;color:#9a9aa3;font-size:14px;">${label}</td>
      <td style="padding:14px 0;border-bottom:1px solid #2a2a30;color:#fff;font-size:16px;font-weight:700;text-align:right;">${value}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#16161A;border-radius:16px;padding:32px;border:1px solid #2a2a30;">
    <p style="color:#D4AF37;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">BookVibe Admin</p>
    <h2 style="margin:0 0 8px;color:#fff;font-size:24px;font-weight:600;">Daily Platform Digest</h2>
    <p style="color:#9a9aa3;font-size:14px;margin:0 0 24px;">Hi ${username}, here's what happened on BookVibe in the last 24 hours.</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row('New Users', stats.newUsers)}
      ${row('New Bookings', stats.newBookings)}
      ${row('Revenue Collected', `PKR ${stats.revenue.toLocaleString()}`)}
      ${row('Platform Commission', `PKR ${stats.commission.toLocaleString()}`)}
      ${row('New Complaints', stats.newComplaints)}
      ${row('Pending Host KYC', stats.pendingKyc)}
    </table>
    <div style="margin:28px 0 0;text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display:inline-block;background:#D4AF37;color:#0C0C0E;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:14px;">
        Open Admin Panel
      </a>
    </div>
    <p style="color:#5a5a63;font-size:11px;text-align:center;margin:28px 0 0;">
      Turn this off anytime in Admin Settings → Notifications → Email Reports.
    </p>
  </div>
</body>
</html>`;
};

/**
 * Sends the daily digest email to a single admin.
 * @param {string} username - The admin's name.
 * @param {string} emailTo - The admin's email address.
 * @param {Object} stats - Aggregated platform stats for the period.
 * @returns {Promise<void>}
 */
const sendAdminDigestEmail = async (username, emailTo, stats) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"BookVibe" <${process.env.MY_EMAIL}>`,
      to: emailTo,
      subject: `BookVibe Daily Digest — ${stats.newBookings} bookings, PKR ${stats.revenue.toLocaleString()} revenue`,
      html: digestHtml(username, stats),
    });
    console.log(`[Email] Admin digest sent to ${emailTo}`);
  } catch (error) {
    console.error('[Email] sendAdminDigestEmail error:', error.message);
  }
};

export { sendAdminDigestEmail };
