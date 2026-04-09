import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type Booking = {
  id: string;
  confirmation_code: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  gross_amount: number | null;
  status: string | null;
};

function guestName(b: Booking) {
  const name = [b.guest_first_name, b.guest_last_name].filter(Boolean).join(' ');
  return name || b.guest_email || 'Guest';
}

function getCurrentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthRange(month: string) {
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 1);

  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  };
}

function escapeCsv(value: unknown) {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  const month = request.nextUrl.searchParams.get('month') || getCurrentMonth();
  const { start, end } = getMonthRange(month);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `
        id,
        confirmation_code,
        guest_first_name,
        guest_last_name,
        guest_email,
        check_in_date,
        check_out_date,
        gross_amount,
        status
      `
    )
    .gte('check_in_date', start)
    .lt('check_in_date', end)
    .not('status', 'in', '("cancelled","no_show")')
    .order('check_in_date', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `Failed to load tax report data: ${error.message}` },
      { status: 500 }
    );
  }

  const rows = (bookings ?? []) as Booking[];

  const headers = [
    'Confirmation',
    'Guest',
    'Check In',
    'Check Out',
    'Gross Collected',
    'Room Revenue',
    'Local Tax 7%',
    'State Tax 1.5%',
    'Total Tax 8.5%',
    'Card Fee 2.9% + 0.30',
    'Net Deposit',
    'Net Revenue',
  ];

  let totalGross = 0;
  let totalRoomRevenue = 0;
  let totalLocalTax = 0;
  let totalStateTax = 0;
  let totalTax = 0;
  let totalCardFees = 0;
  let totalNetDeposit = 0;
  let totalNetRevenue = 0;

  const dataRows = rows.map((b) => {
    const gross = Number(b.gross_amount ?? 0);
    const roomRevenue = gross / 1.085;
    const localTax = roomRevenue * 0.07;
    const stateTax = roomRevenue * 0.015;
    const taxTotal = localTax + stateTax;
    const cardFee = gross * 0.029 + 0.3;
    const netDeposit = gross - cardFee;
    const netRevenue = roomRevenue - cardFee;

    totalGross += gross;
    totalRoomRevenue += roomRevenue;
    totalLocalTax += localTax;
    totalStateTax += stateTax;
    totalTax += taxTotal;
    totalCardFees += cardFee;
    totalNetDeposit += netDeposit;
    totalNetRevenue += netRevenue;

    return [
      b.confirmation_code ?? '',
      guestName(b),
      b.check_in_date ?? '',
      b.check_out_date ?? '',
      gross.toFixed(2),
      roomRevenue.toFixed(2),
      localTax.toFixed(2),
      stateTax.toFixed(2),
      taxTotal.toFixed(2),
      cardFee.toFixed(2),
      netDeposit.toFixed(2),
      netRevenue.toFixed(2),
    ];
  });

  dataRows.push([
    'TOTALS',
    '',
    '',
    '',
    totalGross.toFixed(2),
    totalRoomRevenue.toFixed(2),
    totalLocalTax.toFixed(2),
    totalStateTax.toFixed(2),
    totalTax.toFixed(2),
    totalCardFees.toFixed(2),
    totalNetDeposit.toFixed(2),
    totalNetRevenue.toFixed(2),
  ]);

  const csv = [
    headers.map(escapeCsv).join(','),
    ...dataRows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const filename = `tax-filing-report-${month}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}