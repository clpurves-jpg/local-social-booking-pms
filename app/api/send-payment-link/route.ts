import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

type BookingRow = {
  id: string;
  confirmation_code: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  inventory_id: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  nights: number | null;
  status:
    | 'hold'
    | 'confirmed'
    | 'cancelled'
    | 'refunded'
    | 'checked_in'
    | 'checked_out'
    | 'no_show'
    | null;
  source: string | null;
  hold_expires_at: string | null;
  displayed_flat_rate: number | string | null;
  gross_amount: number | string | null;
  internal_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PaymentRow = {
  id?: string;
  booking_id?: string | null;
  provider?: string | null;
  provider_payment_intent_id?: string | null;
  provider_checkout_session_id?: string | null;
  amount_authorized?: number | string | null;
  amount_captured?: number | string | null;
  currency?: string | null;
  status?: string | null;
  fee_amount?: number | string | null;
  net_amount?: number | string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY.');
  }

  return new Stripe(secretKey);
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY.');
  }

  return new Resend(apiKey);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatMoney(value: number | string | null | undefined, currency = 'USD') {
  const amount = asNumber(value);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getBaseUrl(request: NextRequest) {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL;

  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const host = request.headers.get('host');
  const protocol =
    request.headers.get('x-forwarded-proto') ||
    (host?.includes('localhost') ? 'http' : 'https');

  if (host) {
    return `${protocol}://${host}`;
  }

  return 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let bookingId = '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { bookingId?: string; booking_id?: string };
      bookingId = String(body.bookingId ?? body.booking_id ?? '').trim();
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await request.formData();
      bookingId = String(
        formData.get('bookingId') ?? formData.get('booking_id') ?? '',
      ).trim();
    } else {
      const url = new URL(request.url);
      bookingId = url.searchParams.get('booking_id')?.trim() || '';
    }

    if (!bookingId || !isUuid(bookingId)) {
      return NextResponse.json(
        { error: 'A valid booking UUID is required.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single<BookingRow>();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const guestEmail = booking.guest_email;

    if (!guestEmail) {
      return NextResponse.json(
        { error: 'Guest email is missing for this booking.' },
        { status: 400 },
      );
    }

    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      return NextResponse.json(
        { error: `Cannot send a payment link for a ${booking.status} booking.` },
        { status: 400 },
      );
    }

    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId);

    if (paymentsError) {
      return NextResponse.json(
        { error: 'Failed to load payments for this booking.' },
        { status: 500 },
      );
    }

    const payments = (paymentsData ?? []) as PaymentRow[];

    const grossAmount = asNumber(booking.gross_amount);
    const totalCaptured = payments.reduce(
      (sum, payment) => sum + asNumber(payment.amount_captured),
      0,
    );
    const balanceDue = Math.max(grossAmount - totalCaptured, 0);

    if (balanceDue <= 0) {
      return NextResponse.json(
        { error: 'This booking has no balance due.' },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const resend = getResend();
    const baseUrl = getBaseUrl(request);

    const confirmationCode =
      booking.confirmation_code || booking.id.slice(0, 8).toUpperCase();

    const guestName = [booking.guest_first_name, booking.guest_last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    const stayDescription = `${formatDate(booking.check_in_date)} to ${formatDate(
      booking.check_out_date,
    )}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: guestEmail,
      success_url: `${baseUrl}/booking/confirmed?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/booking/${booking.id}`,
      metadata: {
        booking_id: booking.id,
        confirmation_code: confirmationCode,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(balanceDue * 100),
            product_data: {
              name: `Rivers End Lodging Reservation ${confirmationCode}`,
              description: stayDescription,
            },
          },
        },
      ],
    });

    const { error: insertPaymentError } = await supabase.from('payments').insert({
      booking_id: booking.id,
      provider: 'stripe',
      provider_checkout_session_id: session.id,
      amount_authorized: balanceDue,
      amount_captured: 0,
      currency: 'USD',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertPaymentError) {
      return NextResponse.json(
        { error: insertPaymentError.message || 'Failed to save payment record.' },
        { status: 500 },
      );
    }

    const emailResult = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        'Rivers End Lodging <onboarding@resend.dev>',
      to: guestEmail,
      replyTo: process.env.ADMIN_EMAIL || 'riversendstay@gmail.com',
      subject: 'Payment link for your Rivers End Lodging reservation',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin: 0 0 12px;">Rivers End Lodging</h2>
          <p>Hello ${guestName || 'Guest'},</p>
          <p>
            Here is your secure payment link for reservation
            <strong>${confirmationCode}</strong>.
          </p>
          <p><strong>Stay dates:</strong> ${stayDescription}</p>
          <p><strong>Balance due:</strong> ${formatMoney(balanceDue)}</p>
          <p style="margin: 24px 0;">
            <a
              href="${session.url ?? '#'}"
              style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;"
            >
              Pay Now
            </a>
          </p>
          <p>
            If the button does not work, copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all;">${session.url ?? ''}</p>
          <p>
            Questions? Reply to this email or contact us at ${
              process.env.ADMIN_EMAIL || 'riversendstay@gmail.com'
            }.
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      confirmationCode,
      guestEmail,
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      resendId: emailResult.data?.id ?? null,
      balanceDue,
    });
  } catch (error) {
    console.error('send-payment-link route error', error);

    const message =
      error instanceof Error ? error.message : 'Unexpected server error.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}