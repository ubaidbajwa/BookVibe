/**
 * @file Welcome Email Template
 * @description Generates an HTML email for welcoming new users or hosts.
 */

// Section: Email Templates

/**
 * Generates the welcome email HTML.
 * @param {Object} params - The user details.
 * @param {string} params.username - Name of the user.
 * @param {string} params.role - Role of the user ('host' or 'user').
 * @returns {string} HTML email template.
 */
const welcomeEmail = ({
  username,
  role
}) => `
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
      <h1 style="color:#F5F0E8;font-size:28px;margin:0 0 8px">Welcome, ${username}!</h1>
      <p style="color:#9A958E;font-size:14px;margin:0 0 24px">Your ${role} account is ready.</p>
      <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#C9A84C;font-size:13px;margin:0">
          ${role === 'host'
            ? 'Your documents are under review. We\'ll notify you within 24-48 hours.'
            : 'Start exploring premium stays across Pakistan.'}
        </p>
      </div>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#E2C06D);color:#0C0C0E;font-weight:bold;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px">
        ${role === 'host' ? 'Go to Dashboard' : 'Explore Stays'}
      </a>
    </div>
    <p style="text-align:center;color:#5C5850;font-size:11px;margin-top:30px">© ${new Date().getFullYear()} BookVibe</p>
  </div>
</body>
</html>`;

export default welcomeEmail;
