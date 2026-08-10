import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Petra Paws Pets",
  description:
    "How Petra Paws Pets collects, uses, and protects your personal information when you book mobile pet grooming in Dubai.",
};

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "Who we are",
    body: (
      <>
        <p>
          Petra Paws Pets (&quot;Petra Paws&quot;, &quot;we&quot;, &quot;us&quot;) provides mobile pet
          grooming services in Dubai, UAE. This policy explains how we handle
          personal information when you use{" "}
          <a href="https://petrapawspets.com" className="text-petra-green underline underline-offset-2 hover:text-petra-green-light">
            petrapawspets.com
          </a>{" "}
          or communicate with us about bookings.
        </p>
        <p className="mt-3">
          Contact:{" "}
          <a href="mailto:petrapawspet@gmail.com" className="text-petra-green underline underline-offset-2 hover:text-petra-green-light">
            petrapawspet@gmail.com
          </a>
          {" · "}
          Phone:{" "}
          <a href="tel:+971541996900" className="text-petra-green underline underline-offset-2 hover:text-petra-green-light">
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
          <strong>email</strong> and, when configured, <strong>WhatsApp</strong>{" "}
          (Meta Platforms) to the phone number you provide.
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
          If WhatsApp notifications are enabled, we use Meta&apos;s WhatsApp
          Business Platform to send transactional messages (for example booking
          confirmations) to the number you entered when booking. Staff may also
          reply to customer chats on our WhatsApp Business number.
        </p>
        <p className="mt-3">
          Meta processes message delivery under its own terms and privacy
          policy. We only use WhatsApp account and messaging access to operate
          our own customer communications for Petra Paws Pets—not to sell your
          data or message unrelated third parties.
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
        disputes. You may ask us to update or delete personal data where
        applicable by emailing us.
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
          <a href="mailto:petrapawspet@gmail.com" className="text-petra-green underline underline-offset-2 hover:text-petra-green-light">
            petrapawspet@gmail.com
          </a>
          .
        </li>
        <li>
          You can opt out of non-essential marketing messages. Transactional
          booking messages (confirmations and appointment updates) may still be
          sent when necessary to fulfill your booking.
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
    <div className="min-h-screen bg-petra-sand">
      <Navbar />
      <main className="container-petra py-14 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-petra-gold">Legal</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-petra-green md:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-petra-green/70">
            Last updated: 10 August 2026
          </p>
          <p className="mt-6 text-base leading-relaxed text-petra-green/85">
            This Privacy Policy describes how Petra Paws Pets collects, uses,
            and shares personal information when you book or inquire about our
            mobile pet grooming services.
          </p>

          <div className="mt-10 space-y-10">
            {SECTIONS.map((section, i) => (
              <section key={section.title}>
                <h2 className="font-serif text-xl font-semibold text-petra-green">
                  {i + 1}. {section.title}
                </h2>
                <div className="mt-3 text-sm leading-relaxed text-petra-green/80 md:text-base">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 text-sm text-petra-green/60">
            Questions?{" "}
            <Link
              href="mailto:petrapawspet@gmail.com"
              className="text-petra-green underline underline-offset-2 hover:text-petra-green-light"
            >
              Email us
            </Link>{" "}
            or return to the{" "}
            <Link
              href="/"
              className="text-petra-green underline underline-offset-2 hover:text-petra-green-light"
            >
              home page
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
