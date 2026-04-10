import { NextResponse } from 'next/server';
import { sendAdminNotification, sendGuestReceipt } from '@/lib/email';

export async function GET() {
  try {
    const testEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      'yourlocalsocialteam@gmail.com';

    const guestResult = await sendGuestReceipt({
      email: testEmail,
      name: 'Test Guest',
      checkIn: '2026-03-20',
      checkOut: '2026-03-21',
      room: 'High Desert Lodge - Demo Room',
      total: 1,
    });

    const adminResult = await sendAdminNotification({
      name: 'Test Guest',
      email: testEmail,
      checkIn: '2026-03-20',
      checkOut: '2026-03-21',
      room: 'High Desert Lodge - Demo Room',
      total: 1,
    });

    return NextResponse.json({
      success: true,
      guestEmailSent: !!guestResult,
      adminEmailSent: !!adminResult,
      message: 'Test emails sent successfully for High Desert Lodge demo.',
    });
  } catch (error) {
    console.error('Test email route error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test emails',
      },
      { status: 500 }
    );
  }
}