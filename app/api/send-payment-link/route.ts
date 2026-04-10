import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(key);
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Missing RESEND_API_KEY');
  return new Resend(key);
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getBaseUrl(request: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  const host = request.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';

  return `${protocol}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bookingId = body.bookingId;

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const balanceDue = Number(booking.gross_amount || 0);

    const stripe = getStripe();
    const resend = getResend();
    const baseUrl = getBaseUrl(request);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: booking.guest_email,
      success_url: `${baseUrl}/booking/confirmed?booking_id=${booking.id}`,
      cancel_url: `${baseUrl}/booking/${booking.id}`,
      metadata: { booking_id: booking.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(balanceDue * 100),
            product_data: {
              name: `High Desert Lodge Reservation`,
            },
          },
        },
      ],
    });

    await supabase.from('payments').insert({
      booking_id: booking.id,
      provider: 'stripe',
      provider_checkout_session_id: session.id,
      amount_authorized: balanceDue,
      amount_captured: 0,
      status: 'pending',
    });

    await resend.emails.send({
      from:
        process.env.BOOKING_FROM_EMAIL ||
        'High Desert Lodge <onboarding@resend.dev>',
      to: booking.guest_email,
      replyTo:
        process.env.ADMIN_NOTIFICATION_EMAIL ||
        'yourlocalsocialteam@gmail.com',
      subject: 'Payment link for your High Desert Lodge reservation',
      html: `
        <div style="font-family: Arial; line-height: 1.6;">
          <h2>High Desert Lodge</h2>
          <p>Hello ${booking.guest_first_name || 'Guest'},</p>

          <p>Please complete your reservation payment:</p>

          <p><strong>Amount Due:</strong> ${formatMoney(balanceDue)}</p>

          <p>
            <a href="${session.url}" style="padding:12px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;">
              Pay Now
            </a>
          </p>

          <p>If the button doesn't work, use this link:</p>
          <p>${session.url}</p>

          <p>Thank you,<br/>High Desert Lodge</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Server error sending payment link' },
      { status: 500 }
    );
  }
}