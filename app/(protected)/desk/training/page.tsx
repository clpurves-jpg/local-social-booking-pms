'use client';

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
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        marginBottom: 20,
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

export default function DeskTrainingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f7f8',
        padding: '32px 20px',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #6775b4 0%, #5663a2 100%)',
            color: '#ffffff',
            borderRadius: 20,
            padding: '32px 28px',
            marginBottom: 24,
            boxShadow: '0 8px 24px rgba(103,117,180,0.22)',
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: 14,
              letterSpacing: 1,
              textTransform: 'uppercase',
              opacity: 0.9,
            }}
          >
            Local Social Booking & PMS
          </p>
          <h1
            style={{
              margin: '0 0 10px 0',
              fontSize: 34,
              lineHeight: 1.2,
            }}
          >
            Front Desk Training
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.6,
              maxWidth: 760,
              color: '#eef2ff',
            }}
          >
            This training page is built for front desk staff. Use it to learn
            daily booking tasks, check-ins, check-outs, payments, refunds, and
            housekeeping updates.
          </p>
        </div>

        <Card title="Daily Front Desk Workflow">
          <BulletList
            items={[
              'Review today’s arrivals and departures.',
              'Check for unpaid bookings or payment issues.',
              'Complete guest check-ins and check-outs.',
              'Communicate room status with housekeeping.',
              'Update any notes, charges, or guest details before ending your shift.',
            ]}
          />
        </Card>

        <Card title="How to Create a Booking">
          <StepList
            items={[
              'Go to the Desk booking area.',
              'Click New Booking.',
              'Choose the guest’s check-in and check-out dates.',
              'Select an available room.',
              'Enter the guest’s name, phone number, and email if available.',
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
              'Give the guest their room information and any stay instructions.',
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

        <Card title="Common Troubleshooting">
          <BulletList
            items={[
              'Room not available: check for overlapping bookings or blocked dates.',
              'Cannot check in guest: verify payment status and booking dates.',
              'Payment issue: retry carefully or use another approved payment method.',
              'Wrong room status: update housekeeping status as soon as the issue is discovered.',
            ]}
          />
        </Card>

        <Card title="Quick Reference Rules">
          <BulletList
            items={[
              'Always double-check dates before saving a booking.',
              'Always verify payment before check-in.',
              'Always complete check-out when the guest leaves.',
              'Always keep room status updated.',
              'Always leave notes when something unusual happens.',
            ]}
          />
        </Card>
      </div>
    </div>
  );
}