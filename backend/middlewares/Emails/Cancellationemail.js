/**
 * @file Cancellation Email Template
 * @description Generates an HTML email for booking cancellation.
 */

// Section: Email Templates

/**
 * Generates the booking cancellation email HTML.
 * @param {Object} params - The cancellation details.
 * @param {string} params.guestName - Name of the guest.
 * @param {string} params.propertyName - Name of the property.
 * @param {string} params.bookingId - Unique booking ID.
 * @param {number} [params.refundAmount] - Refund amount, if any.
 * @returns {string} HTML email template.
 */
const cancellationEmail = ({
  guestName,
  propertyName,
  bookingId,
  refundAmount
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:30px">
      <span style="font-size:24px;font-weight:bold;color:#F5F0E8">Book<span style="color:#C9A84C">Vibe</span></span>
    </div>
    <div style="background:#1A1A1F;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px;text-align:center">
      <div style="width:60px;height:60px;background:rgba(248,113,113,0.1);border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center">
        <span style="font-size:28px">✕</span>
      </div>
      <h1 style="color:#F5F0E8;font-size:24px;margin:0 0 8px">Booking Cancelled</h1>
      <p style="color:#9A958E;font-size:14px;margin:0 0 24px">Hi ${guestName}, your booking has been cancelled.</p>
      <div style="background:#0C0C0E;border-radius:12px;padding:20px;text-align:left;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px">Property</td>
            <td style="padding:8px 0;color:#F5F0E8;font-size:13px;text-align:right">${propertyName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px;border-top:1px solid rgba(255,255,255,0.04)">Booking ID</td>
            <td style="padding:8px 0;color:#C9A84C;font-size:13px;text-align:right">#${bookingId}</td>
          </tr>
          ${refundAmount ? `
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px;border-top:1px solid rgba(255,255,255,0.04)">Refund</td>
            <td style="padding:8px 0;color:#4ADE80;font-size:13px;text-align:right;font-weight:bold">PKR ${refundAmount}</td>
          </tr>` : ''}
        </table>
      </div>
      <p style="color:#5C5850;font-size:12px">If you believe this is an error, contact support@bookvibe.com</p>
    </div>
    <p style="text-align:center;color:#5C5850;font-size:11px;margin-top:30px">© ${new Date().getFullYear()} BookVibe</p>
  </div>
</body>
</html>`;
};

export default cancellationEmail;
