"use client";

import Image from "next/image";
import { useBookingModalStore } from "@/lib/store/booking-modal";

export default function CTASection() {
  const openBooking = useBookingModalStore((s) => s.open);

  return (
    <section className="relative bg-white overflow-hidden lg:h-[440px]">
      <div className="flex flex-col lg:grid lg:grid-cols-[33%_67%] lg:h-full">

        {/* ── Text ── */}
        <div className="flex flex-col justify-center px-6 py-10 lg:justify-center lg:px-14 lg:py-0 z-10">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-petra-green leading-tight">
            Book Your Pet&apos;s Grooming Session with Us Today
          </h2>
          {/* Subtext is a desktop-only refinement — the mobile design keeps this section tight */}
          <p className="mt-3 text-sm text-petra-green/55 hidden lg:block">
            Professional care for every furry friend.
          </p>
          <div className="mt-6 lg:mt-7">
            <button
              onClick={openBooking}
              className="inline-flex items-center rounded-full bg-petra-gold px-7 py-3 text-sm font-bold text-white hover:bg-petra-gold-light transition-colors"
            >
              Book a Grooming
            </button>
          </div>
        </div>

        {/* ── Van — object-right anchors to right edge, no right-side gap ── */}
        <div className="relative h-[260px] sm:h-[320px] lg:h-full">
          <Image
            src="/images/pet-van-updated.png"
            alt="Petra Paws grooming van"
            fill
            className="object-contain object-right-bottom"
            priority
            sizes="(min-width: 1024px) 67vw, 100vw"
          />
        </div>

      </div>

    </section>
  );
}
