export default function PetPolicyPage() {
  return (
    <main
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 20px',
        lineHeight: 1.7,
        color: '#0f172a',
      }}
    >
      <h1 style={{ fontSize: '34px', marginBottom: '20px' }}>Pet Policy</h1>

      <p>
        Pets are welcome only in approved accommodations and must be disclosed
        at the time of booking or check-in.
      </p>

      <h2 style={{ marginTop: '28px' }}>Pet Fee</h2>
      <p>
        Pets are $10 each. Additional pet fees may apply depending on the stay
        and reservation details.
      </p>

      <h2 style={{ marginTop: '28px' }}>Guest Responsibilities</h2>
      <p>
        Guests are responsible for keeping pets under control, cleaning up after
        them, and preventing noise or disturbances to other guests.
      </p>

      <h2 style={{ marginTop: '28px' }}>Damages and Excessive Cleaning</h2>
      <p>
        Additional fees may apply for damages, excessive mess, odors, stains, or
        extra cleaning required after the stay.
      </p>

      <h2 style={{ marginTop: '28px' }}>Restrictions</h2>
      <p>
        Breed, size, and quantity restrictions may apply. Pets must not be left
        unattended unless specifically permitted by management.
      </p>

      <h2 style={{ marginTop: '28px' }}>Policy Enforcement</h2>
      <p>
        Failure to follow the pet policy may result in additional charges or
        termination of the stay without refund, subject to applicable law.
      </p>
    </main>
  );
}