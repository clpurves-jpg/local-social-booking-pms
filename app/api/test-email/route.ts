import { NextResponse } from 'next/server';
import { sendAdminNotification, sendGuestReceipt } from '@/lib/email';

export async function GET() {
  try {
    const guestResult = await sendGuestReceipt({
      email: 'riversendstay@gmail.com',
      name: 'Test Guest',
      checkIn: '2026-03-20',
      checkOut: '2026-03-21',
      room: 'Test Room',
      total: 1,
    });

    const adminResult = await sendAdminNotification({
      name: 'Test Guest',
      email: 'riversendstay@gmail.com',
      checkIn: '2026-03-20',
      checkOut: '2026-03-21',
      room: 'Test Room',
      total: 1,
    });

    return NextResponse.json({
      success: true,
      guestResult,
      adminResult,
    });
  } catch (error) {
    console.error('Test email route failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}