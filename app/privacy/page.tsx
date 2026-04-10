export const metadata = {
  title: "Privacy Policy | High Desert Lodge",
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "20px",
        lineHeight: "1.6",
      }}
    >
      <h1>Privacy Policy</h1>

      <p>
        High Desert Lodge respects your privacy. This Privacy Policy explains how
        we collect, use, and protect information when you use our website or make
        a reservation.
      </p>

      <h2>Information We Collect</h2>

      <p>When you make a reservation, we may collect:</p>

      <ul>
        <li>Name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Reservation dates and booking details</li>
      </ul>

      <p>
        Payment information is processed securely by our payment processor and is
        not stored on our servers.
      </p>

      <h2>Payment Processing</h2>

      <p>
        All payments are securely processed through <strong>Stripe</strong>. High
        Desert Lodge does not store credit card numbers on our systems.
      </p>

      <h2>How We Use Your Information</h2>

      <p>Your information is used only for purposes related to your stay, including:</p>

      <ul>
        <li>Managing reservations</li>
        <li>Communicating with guests about bookings</li>
        <li>Processing payments</li>
        <li>Improving guest experience</li>
      </ul>

      <h2>Data Storage</h2>

      <p>
        Reservation information may be stored securely in our booking system to
        manage stays, provide guest services, and meet accounting or legal
        obligations.
      </p>

      <h2>California Privacy Rights</h2>

      <p>
        If you are a California resident, you may request access to, correction
        of, or deletion of your personal information in accordance with
        applicable privacy laws.
      </p>

      <p>To submit a privacy request, please email us at:</p>

      <p>
        <strong>yourlocalsocialteam@gmail.com</strong>
      </p>

      <h2>Contact</h2>

      <p>If you have questions about this Privacy Policy, please contact:</p>

      <p>
        High Desert Lodge
        <br />
        Email: yourlocalsocialteam@gmail.com
      </p>

      <p style={{ marginTop: "40px", fontSize: "14px", color: "#666" }}>
        Last updated: {new Date().getFullYear()}
      </p>
    </div>
  );
}