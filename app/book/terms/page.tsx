export const metadata = {
  title: "Terms of Service | High Desert Lodge",
};

export default function TermsPage() {
  return (
    <div style={{maxWidth: "800px", margin: "40px auto", padding: "20px", lineHeight: "1.6"}}>
      <h1>Terms of Service</h1>

      <p>
        These Terms of Service govern the use of the High Desert Lodge Lodging website and booking
        system.
      </p>

      <h2>Reservations</h2>

      <p>
        Reservations are confirmed once payment has been successfully processed or authorized.
      </p>

      <h2>Payments</h2>

      <p>
        Payments are securely processed through Stripe. High Desert Lodge does not store
        credit card information.
      </p>

      <h2>Cancellations</h2>

      <p>
        Cancellation policies may vary by reservation and will be communicated at the time of
        booking.
      </p>

      <h2>Guest Responsibility</h2>

      <p>
        Guests are responsible for any damages to property during their stay.
      </p>

      <h2>Website Use</h2>

      <p>
        This website and booking system are provided for lawful reservation purposes only.
      </p>

      <h2>Contact</h2>

      <p>
        High Desert Lodge<br/>
        Email: yourlocalsocialteam@gmail.com
      </p>

      <p style={{marginTop: "40px", fontSize: "14px", color: "#666"}}>
        Last updated: {new Date().getFullYear()}
      </p>
    </div>
  );
}