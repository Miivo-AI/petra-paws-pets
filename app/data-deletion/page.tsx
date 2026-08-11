import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "Data Deletion & Retention | Petra Paws Pets",
  description:
    "How to request deletion of personal data held by Petra Paws Pets, and how long we keep booking, payment, and messaging records.",
};

const linkClass =
  "text-petra-green underline underline-offset-2 hover:text-petra-green-light";

const SECTIONS: LegalSection[] = [
  {
    title: "What this page covers",
    body: (
      <>
        <p>
          Petra Paws Pets (&quot;Petra Paws&quot;, &quot;we&quot;,
          &quot;us&quot;) holds personal data about customers who book our
          mobile pet grooming services in Dubai — mainly the contact and
          appointment details you give us when booking, and the booking messages
          we send you by email and WhatsApp.
        </p>
        <p className="mt-3">
          This page explains how to ask us to delete that data, what we delete,
          how long we keep data if you do not ask, and the limited records we
          have to keep by law. It sits alongside our{" "}
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          , which explains what we collect and why.
        </p>
      </>
    ),
  },
  {
    title: "How to request deletion",
    body: (
      <>
        <p>
          You do not need an account to make a request, and there is no charge.
          Send us an email and we will handle it:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Email{" "}
            <a
              href="mailto:petrapawspet@gmail.com?subject=Data%20deletion%20request"
              className={linkClass}
            >
              petrapawspet@gmail.com
            </a>{" "}
            with the subject line <strong>Data deletion request</strong>.
          </li>
          <li>
            Include the name, email address, and phone number you used when
            booking, plus any booking reference you have.
          </li>
          <li>
            Tell us what you want removed — everything we hold, or only specific
            details such as your address or your phone number.
          </li>
        </ol>
        <p className="mt-3">
          If you prefer, you can make the same request by replying to any
          WhatsApp message from us or by calling{" "}
          <a href="tel:+971541996900" className={linkClass}>
            +971 54 199 6900
          </a>
          . To simply stop receiving WhatsApp messages without deleting your
          records, reply <strong>STOP</strong> to any message from us.
        </p>
      </>
    ),
  },
  {
    title: "How we verify a request",
    body: (
      <p>
        So that we do not delete the wrong person&apos;s records, we may ask you
        to confirm details that match the booking, such as the appointment date
        or the address we attended. We will never ask you for a password, a full
        card number, or a one-time passcode as part of this process.
      </p>
    ),
  },
  {
    title: "What happens after you ask",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>We acknowledge your request within 7 days of receiving it.</li>
        <li>
          We complete it within <strong>30 days</strong>. If a request is
          complex and needs longer, we will tell you why and give you a new
          date.
        </li>
        <li>
          We confirm in writing what was deleted and, if anything had to be
          kept, exactly what and for how long.
        </li>
      </ul>
    ),
  },
  {
    title: "What we delete",
    body: (
      <>
        <p>
          On a full deletion request we remove, or irreversibly anonymise, your
          customer record and its contact details, service address, pet profile
          and grooming notes, booking history, and any marketing preferences we
          hold. We also remove your details from the systems we use to send
          email and WhatsApp booking messages, so we stop contacting you.
        </p>
        <p className="mt-3">
          One exception, in your favour: if you had opted out of WhatsApp, we
          keep that opt-out on file against your number. Deleting it would mean
          we could end up messaging you again.
        </p>
      </>
    ),
  },
  {
    title: "What we may have to keep",
    body: (
      <>
        <p>
          A small amount of data may be kept even after a deletion request,
          because the law or a live dispute requires it:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Financial records:</strong> invoices and payment references
            we must retain under UAE tax and accounting rules — generally five
            years.
          </li>
          <li>
            <strong>Records needed for a legal claim:</strong> kept only while
            the claim or complaint is open.
          </li>
          <li>
            <strong>Suppression record:</strong> the minimum needed (for example
            your phone number or email in a do-not-contact list) so that we do
            not message you again by mistake.
          </li>
        </ul>
        <p className="mt-3">
          Anything retained is restricted to that purpose only. It is not used
          for marketing, and it is deleted once the retention period ends.
        </p>
      </>
    ),
  },
  {
    title: "How long we keep data if you do not ask",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Booking and customer records:</strong> while you are an active
          customer and for up to 24 months after your last appointment, then
          deleted or anonymised.
        </li>
        <li>
          <strong>Payment and accounting records:</strong> up to five years, as
          required by UAE law.
        </li>
        <li>
          <strong>Email and WhatsApp message records</strong> (delivery status
          and message references): up to 12 months.
        </li>
        <li>
          <strong>Website and security logs:</strong> up to 90 days.
        </li>
        <li>
          <strong>Do-not-contact records:</strong> kept for as long as needed to
          honour your opt-out.
        </li>
        <li>
          <strong>Backups:</strong> deleted data can remain in encrypted backups
          for a short period until those backups are overwritten in the normal
          cycle, normally within 90 days. Restored data is re-deleted.
        </li>
      </ul>
    ),
  },
  {
    title: "Third parties and WhatsApp",
    body: (
      <>
        <p>
          We ask the providers who process data on our behalf — our hosting and
          database provider, our email provider, and our payment provider — to
          delete or anonymise your data in line with your request and their own
          legal retention duties.
        </p>
        <p className="mt-3">
          Messages we already sent you on WhatsApp are also stored in your own
          WhatsApp app and on Meta&apos;s systems. You can delete the chat on
          your device at any time; how Meta handles WhatsApp data is described
          in the{" "}
          <a
            href="https://www.whatsapp.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            WhatsApp Privacy Policy
          </a>
          , and that part is outside our control.
        </p>
        <p className="mt-3">
          Our website does not use Facebook Login, so there is no connected
          Facebook or Instagram account for you to disconnect. If you have
          messaged our business profile on Instagram or Facebook, you can also
          delete that conversation from within those apps.
        </p>
      </>
    ),
  },
  {
    title: "If we cannot fully delete",
    body: (
      <p>
        In the rare case where we cannot action a request — for example where a
        legal retention period applies, or where we cannot confirm that the
        request comes from the right person — we will explain why in writing and
        tell you what we can do instead, such as restricting how the data is
        used.
      </p>
    ),
  },
  {
    title: "Contact and complaints",
    body: (
      <p>
        Petra Paws Pets · Nadd Al Sheba 1, Dubai, UAE ·{" "}
        <a href="mailto:petrapawspet@gmail.com" className={linkClass}>
          petrapawspet@gmail.com
        </a>{" "}
        ·{" "}
        <a href="tel:+971541996900" className={linkClass}>
          +971 54 199 6900
        </a>
        . If you are not happy with how we handled your request, reply to our
        response and we will review it; you may also raise the matter with the
        competent data protection authority in your jurisdiction.
      </p>
    ),
  },
];

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data Deletion & Retention"
      lastUpdated="11 August 2026"
      intro={
        <p>
          You can ask Petra Paws Pets to delete the personal data we hold about
          you at any time. This page explains how to make that request, what we
          delete, and how long we keep booking, payment, and messaging records.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
