import { Resend } from 'resend';

const FROM_EMAIL = 'High Desert Lodge <yourlocalsocialteam@gmail.com>';

const ADMIN_EMAILS = [
  'yourlocalsocialteam@gmail.com',
  'clpurves@gmail.com',
];

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable');
  }

  return new Resend(apiKey);
}

function normalizeEmail(email: string) {
  return email?.trim().toLowerCase();
}

type GuestReceiptParams = {
  email: string;
  name: string;
  checkIn: string;
  checkOut: string;
  room: string;
  total: number;
};

type AdminNotificationParams = {
  name: string;
  email: string;
  checkIn: string;
  checkOut: string;
  room: string;
  total: number;
};

export async function sendGuestReceipt({
  email,
  name,
  checkIn,
  checkOut,
  room,
  total,
}: GuestReceiptParams) {
  const resend = getResendClient();
  const guestEmail = normalizeEmail(email);

  if (!guestEmail) {
    throw new Error('Guest email is missing');
  }

  console.log('📧 Sending guest receipt to:', guestEmail);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: guestEmail,
      bcc: 'clpurves@gmail.com', // 👈 TEMP DEBUG (remove later)
      subject: 'Your Reservation is Confirmed – High Desert Lodge',
      html: `
        <h2>Reservation Confirmed</h2>
        <p>Hi ${name},</p>
        <p>Thank you for your booking with High Desert Lodge.</p>

        <p><strong>Room:</strong> ${room}</p>
        <p><strong>Check-in:</strong> ${checkIn}</p>
        <p><strong>Check-out:</strong> ${checkOut}</p>

        <p><strong>Total Paid:</strong> $${total.toFixed(2)}</p>

        <p>We look forward to your stay!</p>
      `,
    });

    console.log('✅ Guest email sent:', result);

    return result;
  } catch (err) {
    console.error('❌ Guest email FAILED:', err);
    throw err;
  }
}

export async function sendAdminNotification({
  name,
  email,
  checkIn,
  checkOut,
  room,
  total,
}: AdminNotificationParams) {
  const resend = getResendClient();

  console.log('📧 Sending admin notification');

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAILS,
      subject: 'New Booking – High Desert Lodge',
      html: `
        <h2>New Booking Received</h2>

        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>

        <p><strong>Room:</strong> ${room}</p>
        <p><strong>Check-in:</strong> ${checkIn}</p>
        <p><strong>Check-out:</strong> ${checkOut}</p>

        <p><strong>Total:</strong> $${total.toFixed(2)}</p>
      `,
    });

    console.log('✅ Admin email sent:', result);

    return result;
  } catch (err) {
    console.error('❌ Admin email FAILED:', err);
    throw err;
  }
}