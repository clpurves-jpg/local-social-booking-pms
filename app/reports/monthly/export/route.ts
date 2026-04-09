import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type Booking = {
  gross_amount: number | null;
  check_in_date: string | null;
  status: string | null;
};

function escapeCsv(value: unknown) {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  const selectedMonth =
    req.nextUrl.searchParams.get('month') || getCurrentMonth();

  const { start, end } = getMonthRange(selectedMonth);

  const { data, error } = await supabase
    .from('bookings')
    .select('gross_amount,check_in_date,status')
    .gte('check_in_date', start)
    .lt('check_in_date', end)
    .not('status', 'in', '("cancelled","no_show")')
    .order('check_in_date', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `Failed to load monthly report data: ${error.message}` },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as Booking[];

  const months: Record<
    string,
    {
      date: Date;
      gross: number;
      roomRevenue: number;
      localTax: number;
      stateTax: number;
      taxTotal: number;
      cardFees: number;
      netDeposit: number;
      netRevenue: number;
    }
  > = {};

  rows.forEach((b) => {
    if (!b.check_in_date) return;

    const d = new Date(b.check_in_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!months[key]) {
      months[key] = {
        date: new Date(d.getFullYear(), d.getMonth(), 1),
        gross: 0,
        roomRevenue: 0,
        localTax: 0,
        stateTax: 0,
        taxTotal: 0,
        cardFees: 0,
        netDeposit: 0,
        netRevenue: 0,
      };
    }

    const gross = Number(b.gross_amount ?? 0);
    const roomRevenue = gross / 1.085;
    const localTax = roomRevenue * 0.07;
    const stateTax = roomRevenue * 0.015;
    const taxTotal = localTax + stateTax;
    const cardFee = gross * 0.029 + 0.3;
    const netDeposit = gross - cardFee;
    const netRevenue = roomRevenue - cardFee;

    months[key].gross += gross;
    months[key].roomRevenue += roomRevenue;
    months[key].localTax += localTax;
    months[key].stateTax += stateTax;
    months[key].taxTotal += taxTotal;
    months[key].cardFees += cardFee;
    months[key].netDeposit += netDeposit;
    months[key].netRevenue += netRevenue;
  });

  const sortedMonths = Object.entries(months)
    .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
    .map(([key, value]) => ({ key, ...value }));

  const headers = [
    'Month',
    'Gross',
    'Room Revenue',
    'Local Tax 7%',
    'State Tax 1.5%',
    'Total Tax',
    'Card Fees',
    'Net Deposit',
    'Net Revenue',
  ];

  const csvRows = sortedMonths.map((m) => [
    monthLabel(m.date),
    m.gross.toFixed(2),
    m.roomRevenue.toFixed(2),
    m.localTax.toFixed(2),
    m.stateTax.toFixed(2),
    m.taxTotal.toFixed(2),
    m.cardFees.toFixed(2),
    m.netDeposit.toFixed(2),
    m.netRevenue.toFixed(2),
  ]);

  const totalGross = sortedMonths.reduce((sum, m) => sum + m.gross, 0);
  const totalRoomRevenue = sortedMonths.reduce((sum, m) => sum + m.roomRevenue, 0);
  const totalLocalTax = sortedMonths.reduce((sum, m) => sum + m.localTax, 0);
  const totalStateTax = sortedMonths.reduce((sum, m) => sum + m.stateTax, 0);
  const totalTax = sortedMonths.reduce((sum, m) => sum + m.taxTotal, 0);
  const totalCardFees = sortedMonths.reduce((sum, m) => sum + m.cardFees, 0);
  const totalNetDeposit = sortedMonths.reduce((sum, m) => sum + m.netDeposit, 0);
  const totalNetRevenue = sortedMonths.reduce((sum, m) => sum + m.netRevenue, 0);

  if (sortedMonths.length) {
    csvRows.push([
      'TOTALS',
      totalGross.toFixed(2),
      totalRoomRevenue.toFixed(2),
      totalLocalTax.toFixed(2),
      totalStateTax.toFixed(2),
      totalTax.toFixed(2),
      totalCardFees.toFixed(2),
      totalNetDeposit.toFixed(2),
      totalNetRevenue.toFixed(2),
    ]);
  }

  const csv = [
    headers.map(escapeCsv).join(','),
    ...csvRows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="monthly-summary-${selectedMonth}.csv"`,
    },
  });
}