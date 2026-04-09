'use client';

import { useState } from 'react';

type SectionKey = 'desk' | 'admin' | 'help';

function NavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 10,
        cursor: 'pointer',
        marginBottom: 10,
        background: active ? '#ffffff22' : 'transparent',
        color: '#ffffff',
        border: 'none',
        fontWeight: active ? 700 : 500,
        fontSize: 15,
      }}
    >
      {label}
    </button>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb',
      }}
    >
      <h2
        style={{
          margin: '0 0 14px 0',
          fontSize: 22,
          color: '#1f2937',
        }}
      >
        {title}
      </h2>
      <div style={{ color: '#4b5563', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol style={{ paddingLeft: 22, margin: 0 }}>
      {items.map((item) => (
        <li key={item} style={{ marginBottom: 10 }}>
          {item}
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 22, margin: 0 }}>
      {items.map((item) => (
        <li key={item} style={{ marginBottom: 10 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function DeskTrainingContent() {
  return (
    <>
      <Card title="Daily Front Desk Workflow">
        <BulletList
          items={[
            'Review today’s arrivals and departures.',
            'Check for unpaid bookings or payment issues.',
            'Complete guest check-ins and check-outs.',
            'Communicate room status with housekeeping.',
            'Update notes, charges, or guest details before ending your shift.',
          ]}
        />
      </Card>

      <Card title="How to Create a Booking">
        <StepList
          items={[
            'Go to the Desk booking area.',
            'Click New Booking.',
            'Choose check-in and check-out dates.',
            'Select an available room.',
            'Enter guest details.',
            'Choose the payment method or mark it for desk collection if it is a walk-in.',
            'Review the details carefully and save the booking.',
          ]}
        />
      </Card>

      <Card title="Walk-In Bookings">
        <BulletList
          items={[
            'Always confirm the room and dates before saving.',
            'Collect a phone number whenever possible.',
            'Take payment at the desk if the guest is not already paid.',
            'Add notes for pets, late arrival, special requests, or important instructions.',
          ]}
        />
      </Card>

      <Card title="Check-In Process">
        <StepList
          items={[
            'Open the guest’s booking.',
            'Verify the guest name, stay dates, and assigned room.',
            'Confirm payment status before checking the guest in.',
            'If payment is still due, collect payment before completing check-in unless management instructs otherwise.',
            'Click Check-In.',
            'Give the guest their room information and stay instructions.',
          ]}
        />
      </Card>

      <Card title="Check-Out Process">
        <StepList
          items={[
            'Open the booking for the departing guest.',
            'Confirm the guest has vacated the room.',
            'Review the booking for any final charges or notes.',
            'Click Check-Out.',
            'After check-out, the room should automatically move to Dirty status for housekeeping.',
          ]}
        />
      </Card>

      <Card title="Payments and Manual Charges">
        <BulletList
          items={[
            'Online bookings may already be paid through Stripe.',
            'Walk-ins may need to be charged manually at the desk.',
            'Only add manual charges when you are sure they are correct.',
            'Check the booking details after charging to make sure the payment recorded properly.',
          ]}
        />
      </Card>

      <Card title="Refunds">
        <StepList
          items={[
            'Open the correct booking.',
            'Review the reason for the refund before continuing.',
            'Click Refund.',
            'Enter the correct refund amount.',
            'Confirm the refund action.',
            'Add a note if management wants documentation on why the refund was issued.',
          ]}
        />
      </Card>

      <Card title="Housekeeping Status">
        <BulletList
          items={[
            'Dirty means the room needs cleaning.',
            'Clean means housekeeping finished cleaning the room.',
            'Inspected means the room is fully ready for the next guest if your property uses final inspection.',
            'After a check-out, verify the room moved to Dirty.',
            'Update room status promptly so availability is accurate.',
          ]}
        />
      </Card>
    </>
  );
}

function AdminTrainingContent() {
  return (
    <>
      <Card title="Reports Overview">
        <BulletList
          items={[
            'Review room revenue, pet fees, extra charges, taxes, card fees, and net revenue.',
            'Use reports to confirm that operational activity matches collected payments.',
            'Watch for unusual refunds, missing charges, or payment gaps.',
          ]}
        />
      </Card>

      <Card title="Understanding Revenue and Net">
        <BulletList
          items={[
            'Room revenue is the base lodging income.',
            'Pet fees and extra charges are additional revenue items.',
            'Taxes are collected amounts owed to tax authorities.',
            'Card fees reduce what you actually keep.',
            'Net revenue is what remains after fees and taxes are accounted for in your reporting structure.',
          ]}
        />
      </Card>

      <Card title="Tax Reporting">
        <StepList
          items={[
            'Open the tax reporting page.',
            'Review local tax totals.',
            'Review state tax totals.',
            'Confirm taxable stays and any exceptions.',
            'Use the totals for filing and reconciliation.',
          ]}
        />
      </Card>

      <Card title="Stripe Payout Reconciliation">
        <StepList
          items={[
            'Open the payouts page.',
            'Review the payout date and deposit amount.',
            'Match payout totals against booking payments and refunds.',
            'Confirm whether timing differences explain any mismatch.',
            'Document any unresolved discrepancies before closing the period.',
          ]}
        />
      </Card>

      <Card title="Refund Oversight">
        <BulletList
          items={[
            'Review all refunds regularly.',
            'Make sure the reason for each refund is documented.',
            'Confirm the refund amount matches policy and management approval.',
            'Watch for repeated refund patterns that may indicate training issues.',
          ]}
        />
      </Card>

      <Card title="Daily Admin Workflow">
        <BulletList
          items={[
            'Check arrivals, departures, and occupancy.',
            'Verify payments collected and unpaid bookings.',
            'Confirm rooms moved correctly through housekeeping statuses.',
            'Review exceptions, overrides, cancellations, and refunds.',
          ]}
        />
      </Card>

      <Card title="Weekly Admin Workflow">
        <BulletList
          items={[
            'Review revenue and net trends.',
            'Review tax totals.',
            'Reconcile Stripe payouts and refunds.',
            'Check user activity, housekeeping consistency, and operational issues.',
          ]}
        />
      </Card>

      <Card title="Management Best Practices">
        <BulletList
          items={[
            'Limit admin access to trusted users only.',
            'Use desk roles for day-to-day staff.',
            'Require notes for unusual situations, refunds, or overrides.',
            'Review reports on a schedule instead of waiting until month-end.',
          ]}
        />
      </Card>
    </>
  );
}

function QuickHelpContent() {
  return (
    <>
      <Card title="Room Not Available">
        <BulletList
          items={[
            'Check for overlapping bookings.',
            'Check blocked inventory dates.',
            'Confirm the room was properly checked out and returned to inventory.',
          ]}
        />
      </Card>

      <Card title="Cannot Check In Guest">
        <BulletList
          items={[
            'Verify booking dates.',
            'Verify payment status.',
            'Check whether management override is required.',
          ]}
        />
      </Card>

      <Card title="Payment Issue">
        <BulletList
          items={[
            'Retry carefully if appropriate.',
            'Use another approved payment method if needed.',
            'Check the booking after payment to confirm it recorded correctly.',
          ]}
        />
      </Card>

      <Card title="Wrong Room Status">
        <BulletList
          items={[
            'Open housekeeping.',
            'Update the room to the correct status.',
            'Check whether a checkout step was missed.',
          ]}
        />
      </Card>
    </>
  );
}

export default function AdminTrainingPage() {
  const [active, setActive] = useState<SectionKey>('desk');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f7f7f8' }}>
      <aside
        style={{
          width: 280,
          background: '#6775b4',
          color: '#ffffff',
          padding: 24,
        }}
      >
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: 13,
            letterSpacing: 1,
            textTransform: 'uppercase',
            opacity: 0.9,
          }}
        >
          Local Social Booking & PMS
        </p>

        <h1 style={{ margin: '0 0 24px 0', fontSize: 28 }}>Training Center</h1>

        <NavItem
          label="Front Desk Training"
          active={active === 'desk'}
          onClick={() => setActive('desk')}
        />
        <NavItem
          label="Admin Training"
          active={active === 'admin'}
          onClick={() => setActive('admin')}
        />
        <NavItem
          label="Quick Help"
          active={active === 'help'}
          onClick={() => setActive('help')}
        />
      </aside>

      <main style={{ flex: 1, padding: '32px 24px' }}>
        <div style={{ maxWidth: 1000 }}>
          <p style={{ marginTop: 0, color: '#6b7280', fontSize: 16 }}>
            Admin can access all training modules, including desk operations,
            admin workflows, reporting, taxes, payouts, and troubleshooting.
          </p>

          {active === 'desk' && <DeskTrainingContent />}
          {active === 'admin' && <AdminTrainingContent />}
          {active === 'help' && <QuickHelpContent />}
        </div>
      </main>
    </div>
  );
}