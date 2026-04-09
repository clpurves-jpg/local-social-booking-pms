import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(req: NextRequest) {
  try {
    const { booking_id, amount, reason } = await req.json();

    if (!booking_id || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid data' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: payments, error: paymentError } = await supabase
  .from('payments')
  .select('*')
  .eq('booking_id', booking_id)
  .eq('status', 'paid')
  .order('created_at', { ascending: false });

if (paymentError) {
  console.error('Payment query error:', paymentError);

  return NextResponse.json(
    { error: paymentError?.message || 'Failed to load payment' },
    { status: 500 }
  );
}

const payment =
  (payments ?? []).find((row: any) => row.stripe_payment_method_id) ?? null;

    if (!payment) {
      return NextResponse.json(
        { error: 'No paid payment found for this booking' },
        { status: 400 }
      );
    }

    if (!payment.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer saved for this booking' },
        { status: 400 }
      );
    }
    if (!payment.stripe_payment_method_id) {
  return NextResponse.json(
    { error: 'No saved payment method for this booking' },
    { status: 400 }
  );
}

    const chargeIntent = await stripe.paymentIntents.create({
  amount: Math.round(Number(amount) * 100),
  currency: 'usd',
  customer: payment.stripe_customer_id,
  payment_method: payment.stripe_payment_method_id,
  confirm: true,
  off_session: true,
  metadata: {
    booking_id,
    reason: reason || 'Additional charge',
    charge_type: 'admin_manual_charge',
  },
});

    const { error: insertError } = await supabase.from('payments').insert({
      booking_id,
      provider: 'stripe',
      provider_payment_intent_id: chargeIntent.id,
      stripe_customer_id: payment.stripe_customer_id,
      stripe_payment_method_id: payment.stripe_payment_method_id,
      amount_authorized: Number(amount),
      amount_captured:
        chargeIntent.status === 'succeeded' ? Number(amount) : 0,
      currency: 'usd',
      status: chargeIntent.status === 'succeeded' ? 'paid' : chargeIntent.status,
      paid_at:
        chargeIntent.status === 'succeeded'
          ? new Date().toISOString()
          : null,
    });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      payment_intent_id: chargeIntent.id,
      status: chargeIntent.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Charge failed' },
      { status: 500 }
    );
  }
}