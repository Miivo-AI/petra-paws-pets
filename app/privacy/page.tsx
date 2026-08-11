import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Petra Paws Pets",
  description:
    "How Petra Paws Pets collects, uses, and protects your personal information when you book mobile pet grooming in Dubai.",
};

const linkClass =
  "text-petra-green underline underline-offset-2 hover:text-petra-green-light";

const SECTIONS: LegalSection[] = [
  {
    title: "Who we are",
    body: (
      <>
        <p>
          Petra Paws Pets (&quot;Petra Paws&quot;, &quot;we&quot;, &quot;us&quot;) provides mobile pet
          grooming services in Dubai, UAE. This policy explains how we handle
          personal information when you use{" "}
          <a href="https://petrapawspets.com" className={linkClass}>
            petrapawspets.com
          </a>{" "}
          or communicate with us about bookings.
        </p>
        <p className="mt-3">
          Contact:{" "}
          <a href="mailto:petrapawspet@gmail.com" className={linkClass}>
            petrapawspet@gmail.com
          </a>
          {" · "}
          Phone:{" "}
          <a href="tel:+971541996900" className={linkClass}>
            +971 54 199 6900
          </a>
          {" · "}
          Address: Nadd Al Sheba 1, Dubai, UAE.
        </p>
      </>
    ),
  },
  {
    title: "Information we collect",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Booking details:</strong> your name, email address, phone
          number, service address, preferred appointment date and time, pet
          name, pet type/size/breed, and any notes you provide.
        </li>
        <li>
          <strong>Payment information:</strong> when you pay online, payment is
          processed by our payment provider (Ziina). We receive payment status
          and references; we do not store full card numbers on our servers.
        </li>
        <li>
          <strong>Technical data:</strong> basic logs needed to run and secure
          the website (for example IP address, browser type, and error logs).
        </li>
      </ul>
    ),
  },
  {
    title: "How we use your information",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>To create, confirm, and manage your grooming appointment.</li>
        <li>
          To send booking confirmations and service-related updates by{" "}
          <strong>email</strong> and <strong>WhatsApp</strong> (Meta Platforms)
          to the phone number you provide.
        </li>
        <li>To contact you about appointment details, changes, or support.</li>
        <li>To process payments and prevent fraud or booking abuse.</li>
        <li>To improve our website and services.</li>
      </ul>
    ),
  },
  {
    title: "WhatsApp and Meta",
    body: (
      <>
        <p>
          We use Meta&apos;s WhatsApp Business Platform to send transactional
          messages (for example booking confirmations and appointment updates)
          to the number you entered when booking. Our staff may also reply to
          customer chats on our WhatsApp Business number.
        </p>
        <p className="mt-3">
          WhatsApp messages are opt-in. We send them only if you ticked the
          WhatsApp box on the booking form, or if you messaged us first. We
          record the wording you agreed to along with the date, and we keep a
          record of each message we send you (the number, the time, and whether
          it was delivered) so we can tell whether your confirmation actually
          reached you.
        </p>
        <p className="mt-3">
          Meta processes message delivery under its own terms and{" "}
          <a
            href="https://www.whatsapp.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            privacy policy
          </a>
          . We only use WhatsApp account and messaging access to operate our own
          customer communications for Petra Paws Pets—not to sell your data or
          message unrelated third parties.
        </p>
        <p className="mt-3">
          You can stop WhatsApp messages at any time by replying{" "}
          <strong>STOP</strong> to any message from us, or by emailing us.
          Replying STOP takes effect automatically — your number is added to a
          suppression list and we will not message it again, including if you
          make another booking later. Reply <strong>START</strong> if you change
          your mind.
        </p>
      </>
    ),
  },
  {
    title: "Who we share data with",
    body: (
      <>
        <p>We share personal data only as needed to run the service:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Hosting &amp; database:</strong> infrastructure providers
            that host our website and booking data (for example Vercel and
            Supabase).
          </li>
          <li>
            <strong>Email:</strong> our email delivery provider (Resend) for
            confirmation and alert emails.
          </li>
          <li>
            <strong>Payments:</strong> Ziina for online payment processing.
          </li>
          <li>
            <strong>Messaging:</strong> Meta (WhatsApp) when we send WhatsApp
            confirmations or related service messages.
          </li>
        </ul>
        <p className="mt-3">
          We do not sell your personal information. We may disclose information
          if required by law or to protect our rights and customers.
        </p>
      </>
    ),
  },
  {
    title: "Retention",
    body: (
      <p>
        We keep booking and related records for as long as needed to provide
        the service, meet legal or accounting requirements, and resolve
        disputes. Our{" "}
        <Link href="/data-deletion" className={linkClass}>
          Data Deletion &amp; Retention
        </Link>{" "}
        page sets out how long we keep each type of record and how to ask us to
        delete your data.
      </p>
    ),
  },
  {
    title: "Your choices",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          You can request access to, correction of, or deletion of your personal
          data by contacting{" "}
          <a href="mailto:petrapawspet@gmail.com" className={linkClass}>
            petrapawspet@gmail.com
          </a>
          . See our{" "}
          <Link href="/data-deletion" className={linkClass}>
            data deletion instructions
          </Link>{" "}
          for the steps and timelines.
        </li>
        <li>
          You can opt out of non-essential marketing messages, and stop WhatsApp
          messages by replying <strong>STOP</strong>. Transactional booking
          messages (confirmations and appointment updates) may still be sent
          when necessary to fulfill your booking.
        </li>
      </ul>
    ),
  },
  {
    title: "Security",
    body: (
      <p>
        We use industry-standard measures (HTTPS, access controls, and trusted
        processors) to protect personal data. No method of transmission or
        storage is completely secure; please use a strong unique password if you
        have an account with us.
      </p>
    ),
  },
  {
    title: "Children",
    body: (
      <p>
        Our services are intended for adults arranging pet care. We do not
        knowingly collect personal information from children.
      </p>
    ),
  },
  {
    title: "Changes to this policy",
    body: (
      <p>
        We may update this page from time to time. The &quot;Last updated&quot;
        date at the top will change when we do. Continued use of the website
        after changes means you accept the updated policy.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="11 August 2026"
      intro={
        <p>
          This Privacy Policy describes how Petra Paws Pets collects, uses, and
          shares personal information when you book or inquire about our mobile
          pet grooming services.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
