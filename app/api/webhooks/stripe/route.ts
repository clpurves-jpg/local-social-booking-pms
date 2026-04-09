import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendGuestReceipt, sendAdminNotification } from '@/lib/email';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isWalkInPlaceholderEmail(email: string | null | undefined) {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();

  return (
    normalized === 'walkin@riversendstay.com' ||
    normalized.startsWith('walkin+') ||
    normalized.startsWith('walkin@')
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;

      if (!bookingId) {
        console.error('Missing booking_id metadata');
        return NextResponse.json({ received: true });
      }

      const checkoutSessionId = session.id;
      const amountTotal = asNumber(session.amount_total) / 100;

      const paymentIntentId =
  typeof session.payment_intent === 'string'
    ? session.payment_intent
    : null;

const customerId =
  typeof session.customer === 'string'
    ? session.customer
    : null;

// ✅ NEW — get payment method
let paymentMethodId: string | null = null;

if (paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    paymentMethodId =
      typeof paymentIntent.payment_method === 'string'
        ? paymentIntent.payment_method
        : null;
  } catch (error) {
    console.error('Failed to retrieve payment method:', error);
  }
}

      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('provider_checkout_session_id', checkoutSessionId)
        .maybeSingle();

      if (existingPaymentError) {
        console.error('Failed to load payment row:', existingPaymentError);
        return NextResponse.json({ received: true });
      }

      if (existingPayment) {
        const { error: updatePaymentError } = await supabase
          .from('payments')
         .update({
  provider_payment_intent_id: paymentIntentId,
  stripe_customer_id: customerId,
  stripe_payment_method_id: paymentMethodId, // ✅ ADD THIS
  amount_captured: amountTotal,
  status: 'paid',
  paid_at: new Date().toISOString(),
})
          .eq('provider_checkout_session_id', checkoutSessionId);

        if (updatePaymentError) {
          console.error('Failed to update payment row:', updatePaymentError);
          return NextResponse.json({ received: true });
        }
      } else {
        const { error: insertPaymentError } = await supabase
          .from('payments')
          .insert({
  booking_id: bookingId,
  provider: 'stripe',
  provider_payment_intent_id: paymentIntentId,
  stripe_customer_id: customerId,
  stripe_payment_method_id: paymentMethodId, // ✅ ADD THIS
  provider_checkout_session_id: checkoutSessionId,
            amount_authorized: amountTotal,
            amount_captured: amountTotal,
            currency: (session.currency || 'usd').toLowerCase(),
            status: 'paid',
            paid_at: new Date().toISOString(),
          });

        if (insertPaymentError) {
          console.error('Failed to insert payment row:', insertPaymentError);
          return NextResponse.json({ received: true });
        }
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          inventory_units (
            id,
            name,
            room_type
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Failed to load booking:', bookingError);
        return NextResponse.json({ received: true });
      }

      const gross = asNumber(booking.gross_amount);

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId);

      if (paymentsError) {
        console.error('Failed to load payments for booking:', paymentsError);
        return NextResponse.json({ received: true });
      }

      const totalCaptured = (payments ?? []).reduce(
        (sum, p) => sum + asNumber(p.amount_captured),
        0
      );

      if (totalCaptured >= gross) {
        const { error: confirmError } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            payment_status: 'paid',
            balance_due: 0,
            hold_expires_at: null,
            stripe_payment_intent_id: paymentIntentId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);

        if (confirmError) {
          console.error('Failed to confirm booking:', confirmError);
          return NextResponse.json({ received: true });
        }

        const room = Array.isArray(booking.inventory_units)
          ? booking.inventory_units[0]
          : booking.inventory_units;

        const roomName = room?.name || 'Room';
        const guestName =
          [booking.guest_first_name, booking.guest_last_name]
            .filter(Boolean)
            .join(' ') || 'Guest';

        const shouldSendGuestEmail =
          booking.source !== 'walk_in' &&
          !isWalkInPlaceholderEmail(booking.guest_email);

        console.log('Guest email from DB:', booking.guest_email);
        console.log('Booking source:', booking.source);
        console.log('Send guest email:', shouldSendGuestEmail);

        if (shouldSendGuestEmail) {
          try {
            await sendGuestReceipt({
              email: booking.guest_email,
              name: guestName,
              checkIn: booking.check_in_date,
              checkOut: booking.check_out_date,
              room: roomName,
              total: gross,
            });
            console.log('Guest receipt sent');
          } catch (guestEmailError) {
            console.error('Guest receipt failed:', guestEmailError);
          }
        } else {
          console.log('Skipped guest receipt for walk-in / placeholder email booking');
        }

        try {
          await sendAdminNotification({
            name: guestName,
            email: booking.guest_email,
            checkIn: booking.check_in_date,
            checkOut: booking.check_out_date,
            room: roomName,
            total: gross,
          });
          console.log('Admin notification sent');
        } catch (adminEmailError) {
          console.error('Admin notification failed:', adminEmailError);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}