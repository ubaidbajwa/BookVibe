/**
 * @file Booking Confirmation Email Template
 * @description Generates an HTML email for booking confirmation.
 */

// Section: Email Templates

/**
 * Generates the booking confirmation email HTML.
 * @param {Object} params - The booking details.
 * @param {string} params.guestName - Name of the guest.
 * @param {string} params.propertyName - Name of the property.
 * @param {string} params.checkIn - Check-in date.
 * @param {string} params.checkOut - Check-out date.
 * @param {number} params.totalPrice - Total price of the booking.
 * @param {string} params.bookingId - Unique booking ID.
 * @returns {string} HTML email template.
 */
const bookingConfirmationEmail = ({
  guestName,
  propertyName,
  checkIn,
  checkOut,
  totalPrice,
  bookingId
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:30px">
      <span style="font-size:24px;font-weight:bold;color:#F5F0E8">Book<span style="color:#C9A84C">Vibe</span></span>
    </div>
    <div style="background:#1A1A1F;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px;text-align:center">
      <div style="width:60px;height:60px;background:rgba(201,168,76,0.15);border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center">
        <span style="font-size:28px">✓</span>
      </div>
      <h1 style="color:#F5F0E8;font-size:24px;margin:0 0 8px">Booking Confirmed!</h1>
      <p style="color:#9A958E;font-size:14px;margin:0 0 30px">Your stay has been booked successfully</p>
      <div style="background:#0C0C0E;border-radius:12px;padding:24px;text-align:left;margin-bottom:24px">
        <p style="color:#C9A84C;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px">Booking Details</p>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px">Guest</td>
            <td style="padding:8px 0;color:#F5F0E8;font-size:13px;text-align:right;font-weight:600">${guestName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px;border-top:1px solid rgba(255,255,255,0.04)">Property</td>
            <td style="padding:8px 0;color:#F5F0E8;font-size:13px;text-align:right;font-weight:600;border-top:1px solid rgba(255,255,255,0.04)">${propertyName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px;border-top:1px solid rgba(255,255,255,0.04)">Check-in</td>
            <td style="padding:8px 0;color:#F5F0E8;font-size:13px;text-align:right;font-weight:600;border-top:1px solid rgba(255,255,255,0.04)">${checkIn}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px;border-top:1px solid rgba(255,255,255,0.04)">Check-out</td>
            <td style="padding:8px 0;color:#F5F0E8;font-size:13px;text-align:right;font-weight:600;border-top:1px solid rgba(255,255,255,0.04)">${checkOut}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#9A958E;font-size:13px;border-top:1px solid rgba(255,255,255,0.04)">Booking ID</td>
            <td style="padding:8px 0;color:#C9A84C;font-size:13px;text-align:right;font-weight:600;border-top:1px solid rgba(255,255,255,0.04)">#${bookingId}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#C9A84C;font-size:15px;font-weight:bold;border-top:1px solid rgba(201,168,76,0.2)">Total</td>
            <td style="padding:12px 0;color:#C9A84C;font-size:15px;text-align:right;font-weight:bold;border-top:1px solid rgba(201,168,76,0.2)">PKR ${totalPrice}</td>
          </tr>
        </table>
      </div>
      <p style="color:#5C5850;font-size:12px;margin:20px 0 0">Questions? Reply to this email or contact support@bookvibe.com</p>
    </div>
    <p style="text-align:center;color:#5C5850;font-size:11px;margin-top:30px">© ${new Date().getFullYear()} BookVibe. All rights reserved.</p>
  </div>
</body>
</html>`;
};

export default bookingConfirmationEmail;
