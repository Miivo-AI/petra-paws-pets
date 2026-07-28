"use client";

import Image from "next/image";
import { useBookingModalStore } from "@/lib/store/booking-modal";

const STEPS = [
  {
    icon: "/images/calendar-clock.png",
    title: "Book your slot",
    body: "Pick a date and time that suits you. We're open six days a week (we rest on Mondays).",
    badge: "Replies in ~5 min",
    cardBg: "#FFFFFF",
    badgeBg: "rgba(0,0,0,0.06)",
  },
  {
    icon: "/images/truck.png",
    title: "We come to you",
    body: "Your pet stays safe and comfortable at home.",
    badge: "On-time, every time",
    cardBg: "#D9C4A0",
    badgeBg: "rgba(0,0,0,0.08)",
  },
  {
    icon: "/images/paynrelax.png",
    title: "Pay & relax",
    body: "Secure online payment with no hidden fees.",
    badge: "~60–90 minutes",
    cardBg: "#AECDC8",
    badgeBg: "rgba(0,0,0,0.08)",
  },
];

export default function HowItWorks() {
  const openBooking = useBookingModalStore((s) => s.open);

  return (
    <section id="how-it-works" className="bg-petra-green py-20 lg:py-28 scroll-mt-16">
      <div className="container-petra">

        {/* Heading */}
        <h2 className="font-serif text-4xl font-bold text-white text-center mb-12 lg:text-5xl">
          Three Steps to A Happy Pet
        </h2>

        {/* Cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-12">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="rounded-3xl p-7 flex flex-col gap-5"
              style={{ backgroundColor: step.cardBg }}
            >
              {/* Icon */}
              <div className="h-11 w-11 relative flex-shrink-0">
                <Image
                  src={step.icon}
                  alt={step.title}
                  fill
                  className="object-contain object-left-top"
                  sizes="44px"
                />
              </div>

              {/* Text */}
              <div className="flex-1">
                <h3 className="font-serif text-lg font-bold text-[#1C3328] mb-2 leading-snug">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#1C3328]/60">
                  {step.body}
                </p>
              </div>

              {/* Badge */}
              <div
                className="self-start inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
                style={{ backgroundColor: step.badgeBg }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 7l3.5 3.5L11 4" stroke="#1C3328" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[12px] font-medium text-[#1C3328]/75">
                  {step.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={openBooking}
            className="inline-flex items-center gap-2 rounded-full bg-petra-gold px-8 py-3.5 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Book a Grooming
          </button>
        </div>

      </div>
    </section>
  );
}
