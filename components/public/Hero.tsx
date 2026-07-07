"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useBookingModalStore } from "@/lib/store/booking-modal";

const SLIDES = [
  {
    src: "/images/hero-img.png",
    alt: "Golden retriever and cat waiting by the door for grooming",
  },
  {
    src: "/images/hero-2.png",
    alt: "Petra Paws grooming van parked in a Dubai neighbourhood",
  },
  {
    src: "/images/hero-3.png",
    alt: "Corgi being gently bathed during a grooming session",
  },
];

const SLIDE_DURATION_MS = 6000;
const INITIAL_SLIDE = 1; // hero-2.png

export default function Hero() {
  const [current, setCurrent] = useState(INITIAL_SLIDE);
  const openBooking = useBookingModalStore((s) => s.open);

  useEffect(() => {
    const timer = setInterval(
      () => setCurrent((i) => (i + 1) % SLIDES.length),
      SLIDE_DURATION_MS
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-[600px] lg:min-h-screen bg-petra-green overflow-hidden">
      {/* Background image carousel — crossfades between slides */}
      {SLIDES.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={i === INITIAL_SLIDE}
          className={`object-cover object-center transition-opacity duration-1000 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
          sizes="100vw"
        />
      ))}
      {/* Gradient overlay: bottom-up on mobile (stacked text needs a scrim behind it),
          left-to-right on desktop (text sits in the left half only) */}
      <div className="absolute inset-0 bg-gradient-to-t from-petra-green/90 via-petra-green/40 to-transparent lg:bg-gradient-to-r lg:from-petra-green/90 lg:via-petra-green/50 lg:to-transparent" />

      {/* Content */}
      <div className="relative container-petra flex min-h-[600px] lg:min-h-screen items-end lg:items-center pb-12 lg:pb-0 pt-16">
        <div className="max-w-xl py-6 lg:py-24 space-y-4 lg:space-y-6">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight text-white lg:text-6xl">
            Professional Pet Grooming at Your Doorstep
          </h1>
          {/* Shorter copy on mobile, full copy from lg up */}
          <p className="text-base leading-relaxed text-white/85 max-w-md lg:hidden">
            A mobile grooming spa for pets, offering a calming grooming
            experience at home.
          </p>
          <p className="hidden lg:block text-base leading-relaxed text-white/75 max-w-md">
            A mobile grooming spa for pets, offering a calming grooming
            experience. Say goodbye to transport hassles and enjoy a pampering
            session for your furry friend.
          </p>
          <div className="flex gap-2 sm:gap-3 pt-2 lg:flex-wrap lg:items-center">
            <button
              onClick={openBooking}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-full bg-petra-gold px-3 sm:px-7 py-3.5 text-[13px] sm:text-sm font-bold text-white shadow-md hover:bg-petra-gold-light transition-colors text-center whitespace-nowrap"
            >
              Book a Grooming
            </button>
            <Link
              href="#services"
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-full bg-white px-3 sm:px-7 py-3.5 text-[13px] sm:text-sm font-bold text-petra-green hover:bg-white/90 transition-colors text-center whitespace-nowrap"
            >
              See Services
            </Link>
          </div>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 lg:bottom-8">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            onClick={() => setCurrent(i)}
            aria-label={`Show slide ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-petra-gold" : "w-2 bg-white/50 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
