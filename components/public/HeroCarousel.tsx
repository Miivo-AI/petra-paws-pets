"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// 4 hero slide variants — replace bg with real images using next/image
const SLIDES = [
  {
    id: 1,
    // Slide 1: Dog + cat portrait (cream/light bg, image right)
    eyebrow: "Dubai's premium mobile grooming",
    heading: "Pet Grooming\nthat comes to you",
    body: "No car rides, no waiting rooms, no unfamiliar smells. Just a calm pet, a trained groomer, and a grooming done right, just outside your door.",
    imageBg: "from-petra-cream to-[#EDE5CF]",
    imageAlt: "Golden retriever and cat sitting together",
    imageSrc: null, // Replace with actual image path
    overlay: false,
  },
  {
    id: 2,
    eyebrow: "Serving Nad Al Sheba · Meydan · Business Bay",
    heading: "Pet Grooming\nthat comes to you",
    body: "Professional grooming for your dog or cat — at your home, on your schedule. Secure upfront payment, instant confirmation.",
    imageBg: "from-[#D6E8DC] to-petra-cream",
    imageAlt: "Fluffy dog portrait",
    imageSrc: null,
    overlay: false,
  },
  {
    id: 3,
    // Van on location — dark overlay
    eyebrow: "One groomer. One van. All yours.",
    heading: "Pet Grooming\nthat comes to you",
    body: "Our fully equipped grooming van parks right outside your building. Your pet never has to leave the neighbourhood.",
    imageBg: "from-petra-green to-petra-green-light",
    imageAlt: "Petra Paws grooming van on location",
    imageSrc: null,
    overlay: true,
  },
  {
    id: 4,
    // Grooming close-up — dark overlay
    eyebrow: "Trained, certified groomers",
    heading: "Pet Grooming\nthat comes to you",
    body: "Your pet is in expert hands. Bath, blow-dry, cut, and more — all done with patience and care.",
    imageBg: "from-[#2A3828] to-petra-green",
    imageAlt: "Professional groomer bathing a dog",
    imageSrc: null,
    overlay: true,
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(index);
        setIsTransitioning(false);
      }, 300);
    },
    [isTransitioning]
  );

  const next = useCallback(() => {
    goTo((current + 1) % SLIDES.length);
  }, [current, goTo]);

  useEffect(() => {
    const timer = setInterval(next, 5500);
    return () => clearInterval(timer);
  }, [next]);

  const slide = SLIDES[current];
  const isDark = slide.overlay;

  return (
    <section
      className={`relative min-h-screen pt-16 flex items-center bg-gradient-to-br ${slide.imageBg} transition-all duration-500`}
    >
      <div className="container-petra w-full py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div
            className={`space-y-6 transition-opacity duration-300 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {/* Eyebrow */}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide ${
                isDark
                  ? "bg-white/15 text-white"
                  : "bg-petra-green/10 text-petra-green"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-petra-gold inline-block" />
              {slide.eyebrow}
            </span>

            {/* Heading */}
            <h1
              className={`font-serif text-5xl font-bold leading-tight lg:text-6xl xl:text-7xl ${
                isDark ? "text-white" : "text-petra-green"
              }`}
            >
              {slide.heading.split("\n").map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h1>

            {/* Body */}
            <p
              className={`text-lg leading-relaxed max-w-md ${
                isDark ? "text-white/80" : "text-petra-green/75"
              }`}
            >
              {slide.body}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-full bg-petra-gold px-7 py-3.5 text-sm font-bold text-white shadow-md hover:bg-petra-gold-light transition-colors"
              >
                Book a Grooming
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <Link
                href="#services"
                className={`inline-flex items-center gap-2 rounded-full border-2 px-7 py-3.5 text-sm font-bold transition-colors ${
                  isDark
                    ? "border-white/40 text-white hover:bg-white/10"
                    : "border-petra-green/30 text-petra-green hover:bg-petra-green/5"
                }`}
              >
                See Services
              </Link>
            </div>

            {/* Dots */}
            <div className="flex items-center gap-2 pt-4">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === current
                      ? "w-8 h-2 bg-petra-gold"
                      : isDark
                      ? "w-2 h-2 bg-white/40 hover:bg-white/60"
                      : "w-2 h-2 bg-petra-green/30 hover:bg-petra-green/50"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Image placeholder — replace with next/image */}
          <div
            className={`relative hidden lg:flex items-center justify-center transition-opacity duration-300 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            <div
              className={`w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center ${
                isDark
                  ? "bg-white/10 border border-white/20"
                  : "bg-petra-green/10 border border-petra-green/15"
              }`}
            >
              {/*
                Replace this div with:
                <Image
                  src="/images/hero-slide-{current+1}.jpg"
                  alt={slide.imageAlt}
                  fill
                  className="object-cover"
                  priority
                />
              */}
              <div className="text-center p-8">
                <div
                  className={`mx-auto mb-4 h-20 w-20 rounded-full flex items-center justify-center ${
                    isDark ? "bg-white/20" : "bg-petra-green/15"
                  }`}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    className="text-petra-gold"
                  >
                    <ellipse cx="11" cy="10" rx="5" ry="7" fill="currentColor" />
                    <ellipse cx="29" cy="10" rx="5" ry="7" fill="currentColor" />
                    <ellipse cx="5" cy="23" rx="4" ry="5.5" fill="currentColor" />
                    <ellipse cx="35" cy="23" rx="4" ry="5.5" fill="currentColor" />
                    <path
                      d="M20 17c-7 0-13 4.5-13 11C7 33 12 38 20 38s13-5 13-10c0-6.5-6-11-13-11z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <p
                  className={`text-sm font-medium ${
                    isDark ? "text-white/60" : "text-petra-green/50"
                  }`}
                >
                  {slide.imageAlt}
                  <br />
                  <span className="text-xs">(add image here)</span>
                </p>
              </div>
            </div>

            {/* Floating trust badge */}
            <div
              className={`absolute -bottom-4 left-6 rounded-2xl px-4 py-3 shadow-xl ${
                isDark ? "bg-white" : "bg-petra-green text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center ${
                    isDark ? "bg-petra-gold/15" : "bg-white/15"
                  }`}
                >
                  <span className="text-lg">⭐</span>
                </div>
                <div>
                  <p
                    className={`text-xs font-bold ${
                      isDark ? "text-petra-green" : "text-white"
                    }`}
                  >
                    5.0 Rating
                  </p>
                  <p
                    className={`text-[10px] ${
                      isDark ? "text-petra-green/60" : "text-white/70"
                    }`}
                  >
                    Loved across Dubai
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile dots (below content) */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 lg:hidden">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? "w-8 h-2 bg-petra-gold"
                : "w-2 h-2 bg-petra-green/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
