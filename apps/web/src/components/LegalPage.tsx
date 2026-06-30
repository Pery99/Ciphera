import { ArrowLeft } from "lucide-react";
import { CipheraMascot } from "./CipheraMascot.tsx";

type LegalPageProps = {
  kind: "privacy" | "terms";
};

const UPDATED_AT = "June 30, 2026";

export function LegalPage({ kind }: LegalPageProps) {
  const isPrivacy = kind === "privacy";

  return (
    <main className="legal-screen">
      <article className="legal-page">
        <header className="legal-header">
          <a className="legal-back tap-spring" href="/" aria-label="Back to Ciphera">
            <ArrowLeft size={18} />
            <span>Ciphera</span>
          </a>
          <CipheraMascot size={72} animated />
          <p className="legal-kicker">Ciphera</p>
          <h1>{isPrivacy ? "Privacy Policy" : "Terms & Conditions"}</h1>
          <p className="legal-updated">Last updated: {UPDATED_AT}</p>
        </header>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </article>
    </main>
  );
}

function PrivacyContent() {
  return (
    <div className="legal-content">
      <section className="legal-notice">
        <p>
          Ciphera is a portfolio messaging project. It demonstrates privacy-minded product architecture, client-side encrypted payload workflows, realtime messaging, and encrypted media handling.
        </p>
      </section>

      <section>
        <h2>Information We Store</h2>
        <p>
          Ciphera may store account details, usernames, email addresses, hashed passwords, refresh-session records, conversation membership, invite records, encrypted message payloads, attachment metadata, delivery/read metadata, and push notification subscription metadata.
        </p>
      </section>

      <section>
        <h2>Message And Media Content</h2>
        <p>
          Message bodies and uploaded media are encrypted in the browser before being sent to the backend. The API stores encrypted envelopes, encrypted media references, and metadata needed to operate the app. Ciphera does not store plaintext message bodies or raw media contents.
        </p>
        <p>
          Ciphera should be described as client-side encrypted. It is not a production secure messenger and does not implement a full production end-to-end encryption protocol.
        </p>
      </section>

      <section>
        <h2>Cookies And Sessions</h2>
        <p>
          Ciphera uses HTTP-only refresh cookies for account sessions. Browser JavaScript receives short-lived access tokens, but refresh tokens are not intentionally exposed to frontend code.
        </p>
      </section>

      <section>
        <h2>Notifications</h2>
        <p>
          If notifications are enabled, Ciphera stores browser push subscription details and may send metadata-only notifications such as a conversation identifier and message identifier. Notification payloads do not include plaintext message content.
        </p>
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>
          Ciphera may use infrastructure providers for hosting, PostgreSQL, Redis, Cloudinary media storage, and browser push delivery. These providers may process technical metadata required to run the service.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>For questions, open an issue on the GitHub repository or contact the project maintainer.</p>
      </section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="legal-content">
      <section className="legal-notice">
        <p>
          Ciphera is provided as a portfolio project and technical demonstration. By using it, you understand that the service may change, break, lose data, or be taken offline.
        </p>
      </section>

      <section>
        <h2>Acceptable Use</h2>
        <p>
          Do not use Ciphera for harassment, spam, abuse, illegal activity, attempts to compromise the service, or storing highly sensitive information.
        </p>
      </section>

      <section>
        <h2>Account Responsibility</h2>
        <p>You are responsible for the activity on your account and for keeping your login credentials private.</p>
      </section>

      <section>
        <h2>Service Availability</h2>
        <p>Ciphera is not guaranteed to be available at all times. Features may be changed, limited, or removed as the project evolves.</p>
      </section>

      <section>
        <h2>Security Scope</h2>
        <p>
          Ciphera demonstrates client-side encrypted payload workflows, but it is not a production secure messenger. Do not rely on it for legal, medical, financial, emergency, or other highly sensitive communication.
        </p>
      </section>

      <section>
        <h2>No Warranty</h2>
        <p>Ciphera is provided as-is, without warranties of availability, correctness, security, or fitness for a particular purpose.</p>
      </section>
    </div>
  );
}
