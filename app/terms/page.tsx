import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | Petra Paws Pets",
  description:
    "Terms governing use of the Petra Paws Pets website and mobile pet grooming bookings in Dubai, UAE.",
};

const linkClass =
  "text-petra-green underline underline-offset-2 hover:text-petra-green-light";

const SECTIONS: LegalSection[] = [
  {
    title: "Agreement to these terms",
    body: (
      <>
        <p>
          These Terms of Service (&quot;Terms&quot;) apply when you use{" "}
          <a href="https://petrapawspets.com" className={linkClass}>
            petrapawspets.com
          </a>
          , book a grooming appointment, or communicate with us about a booking.
          By doing any of these, you agree to these Terms and to our{" "}
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          . If you do not agree, please do not use the website or book a
          service.
        </p>
        <p className="mt-3">
          Petra Paws Pets (&quot;Petra Paws&quot;, &quot;we&quot;,
          &quot;us&quot;) is a mobile pet grooming business based at Nadd Al
          Sheba 1, Dubai, UAE. You can reach us at{" "}
          <a href="mailto:petrapawspet@gmail.com" className={linkClass}>
            petrapawspet@gmail.com
          </a>{" "}
          or{" "}
          <a href="tel:+971541996900" className={linkClass}>
            +971 54 199 6900
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "Who may book",
    body: (
      <p>
        You must be at least 18 years old and able to enter into a binding
        agreement. By booking, you confirm that you are the owner of the pet or
        that you are authorised by the owner to arrange grooming for it, and
        that the contact details you give us are yours to use.
      </p>
    ),
  },
  {
    title: "Our services",
    body: (
      <>
        <p>
          We provide mobile dog and cat grooming at the address you give us,
          within the Dubai areas we list as serviceable at the time of booking.
          Services, prices, and time slots shown on the website are estimates
          until we confirm your appointment.
        </p>
        <p className="mt-3">
          We may decline, reschedule, or end an appointment where necessary for
          safety, weather, access, capacity, or other operational reasons. If a
          pet&apos;s coat condition, size, or behaviour differs materially from
          the details given at booking, the time and price may change; we will
          tell you before carrying out any additional work.
        </p>
      </>
    ),
  },
  {
    title: "Bookings and payments",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          You are responsible for giving accurate contact, address, and pet
          details. Incorrect details may prevent us from reaching you or
          completing the appointment.
        </li>
        <li>
          Prices are shown in UAE Dirhams (AED). Online payments are processed
          by our payment provider, Ziina. We do not receive or store your full
          card details.
        </li>
        <li>
          Where you choose to pay on arrival, payment is due at the appointment
          once the service is complete.
        </li>
        <li>
          A booking is confirmed only when we send you a confirmation by email
          or WhatsApp.
        </li>
      </ul>
    ),
  },
  {
    title: "Cancellations, rescheduling, and no-shows",
    body: (
      <p>
        Please tell us as early as you can if you need to cancel or reschedule,
        by replying to your confirmation or contacting us on the details above.
        If nobody is available at the address at the booked time, or if we
        cannot safely carry out the service on arrival, we may treat the
        appointment as a no-show and charge a call-out fee where we told you
        about it at the time of booking. Refunds of online payments are made to
        the original payment method and may take several business days to
        appear.
      </p>
    ),
  },
  {
    title: "Communications, email, and WhatsApp",
    body: (
      <>
        <p>
          When you give us your phone number and email address, you agree that
          we may contact you about your booking — for example confirmations,
          appointment reminders, changes, and follow-up questions — by email or
          phone call.
        </p>
        <p className="mt-3">
          WhatsApp is separate and optional: we only message you on WhatsApp if
          you tick the WhatsApp box on the booking form. If you leave it
          unticked we will not send you WhatsApp messages, and you will still
          receive your booking confirmation by email.
        </p>
        <p className="mt-3">
          WhatsApp messages are sent through Meta&apos;s WhatsApp Business
          Platform to the number you entered when booking, and are subject to
          WhatsApp&apos;s own{" "}
          <a
            href="https://www.whatsapp.com/legal/business-terms/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Business Terms
          </a>{" "}
          and{" "}
          <a
            href="https://www.whatsapp.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Privacy Policy
          </a>
          . We use these messages to run our own customer service only. We do
          not sell your number, share it for third-party advertising, or send
          unrelated promotional messages.
        </p>
        <p className="mt-3">
          You can stop WhatsApp messages at any time by replying{" "}
          <strong>STOP</strong> to any message from us, or by emailing{" "}
          <a href="mailto:petrapawspet@gmail.com" className={linkClass}>
            petrapawspet@gmail.com
          </a>
          . We may still need to contact you by email or phone about an
          appointment you have already booked.
        </p>
      </>
    ),
  },
  {
    title: "Your responsibilities at the appointment",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Make sure an adult who can authorise the service is present at the
          booked time and address.
        </li>
        <li>
          Provide reasonable access for our vehicle and equipment, including
          parking where the service requires it.
        </li>
        <li>
          Tell us in advance about behaviour, health conditions, injuries,
          allergies, skin conditions, parasites, or handling needs that could
          affect grooming safety.
        </li>
        <li>
          Keep your pet&apos;s vaccinations up to date in line with UAE
          requirements.
        </li>
      </ul>
    ),
  },
  {
    title: "Pet health and safety",
    body: (
      <p>
        We are groomers, not veterinarians, and we do not provide veterinary
        advice or treatment. We may pause or stop a groom if a pet becomes
        distressed, aggressive, or unwell, or if continuing would risk the
        pet&apos;s or the groomer&apos;s safety; the service may still be
        charged for the time spent. If we notice something that looks like it
        needs veterinary attention, we will tell you, but any veterinary care
        and its cost remain your responsibility. Grooming can occasionally
        reveal pre-existing conditions such as matting-related skin irritation.
      </p>
    ),
  },
  {
    title: "Acceptable use of the website",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Do not make fraudulent, fake, or automated bookings, or use someone
          else&apos;s details.
        </li>
        <li>
          Do not attempt to interfere with, scrape, overload, or gain
          unauthorised access to the website, our accounts, or our systems.
        </li>
        <li>Do not use the website for anything unlawful.</li>
      </ul>
    ),
  },
  {
    title: "Content and intellectual property",
    body: (
      <p>
        The website, its text, images, and branding belong to Petra Paws Pets or
        our licensors, and may not be copied or reused without our permission.
        Third-party names and logos, including WhatsApp and Meta, belong to
        their respective owners and are used only to describe the services we
        rely on.
      </p>
    ),
  },
  {
    title: "Third-party services",
    body: (
      <p>
        We rely on third parties to operate the service, including hosting and
        database providers, our email provider, our payment provider, and
        Meta&apos;s WhatsApp Business Platform for messaging. Their own terms
        apply to their services, and we are not responsible for outages or acts
        outside our reasonable control.
      </p>
    ),
  },
  {
    title: "Disclaimers and limitation of liability",
    body: (
      <p>
        We provide our services with reasonable skill and care, and the website
        is provided on an &quot;as is&quot; basis without a guarantee of
        uninterrupted availability. To the fullest extent permitted by UAE law,
        we are not liable for indirect, incidental, or consequential losses, and
        our total liability in connection with a booking is limited to the
        amount you paid for that booking. Nothing in these Terms excludes or
        limits liability that cannot be excluded or limited by law.
      </p>
    ),
  },
  {
    title: "Privacy and your data",
    body: (
      <p>
        How we collect and use personal information is explained in our{" "}
        <Link href="/privacy" className={linkClass}>
          Privacy Policy
        </Link>
        . How long we keep it, and how to ask us to delete it, is explained on
        our{" "}
        <Link href="/data-deletion" className={linkClass}>
          Data Deletion &amp; Retention
        </Link>{" "}
        page.
      </p>
    ),
  },
  {
    title: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the United Arab Emirates as
        applied in the Emirate of Dubai, and the courts of Dubai have
        jurisdiction over any dispute. We would always prefer to resolve issues
        directly first, so please contact us before taking any other step.
      </p>
    ),
  },
  {
    title: "Changes to these terms",
    body: (
      <p>
        We may update these Terms from time to time. The &quot;Last updated&quot;
        date at the top of this page will change when we do, and the version
        published here at the time of your booking is the one that applies to
        it. Continued use of the website after changes means you accept the
        updated Terms.
      </p>
    ),
  },
  {
    title: "Contact us",
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
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="11 August 2026"
      intro={
        <p>
          These Terms set out the rules for using the Petra Paws Pets website
          and for booking our mobile pet grooming services in Dubai. Please read
          them before you book.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
