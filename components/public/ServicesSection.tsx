"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PetType, PetSize } from "@/lib/types";

type ServiceWithPrices = {
  id: string;
  name: string;
  duration_minutes: number;
  features: string[];
  active: boolean;
  prices: {
    service_id: string;
    pet_type: string;
    size: string | null;
    amount: number;
  }[];
};

const DOG_SIZES: PetSize[] = ["small", "medium", "large"];

const FALLBACK_SERVICES: ServiceWithPrices[] = [
  {
    id: "basic",
    name: "Basic Grooming",
    duration_minutes: 90,
    features: ["Bathing", "Blow Dry", "Nail Clipping", "Ear Cleaning", "Teeth Brush"],
    active: true,
    prices: [
      { service_id: "basic", pet_type: "dog", size: "small",  amount: 210 },
      { service_id: "basic", pet_type: "dog", size: "medium", amount: 275 },
      { service_id: "basic", pet_type: "dog", size: "large",  amount: 310 },
      { service_id: "basic", pet_type: "cat", size: null,     amount: 180 },
    ],
  },
  {
    id: "full",
    name: "Full Grooming",
    duration_minutes: 120,
    features: ["Hair Cut", "Bathing", "Blow Dry", "Nail Clipping", "Ear Cleaning", "Teeth Brush"],
    active: true,
    prices: [
      { service_id: "full", pet_type: "dog", size: "small",  amount: 249 },
      { service_id: "full", pet_type: "dog", size: "medium", amount: 299 },
      { service_id: "full", pet_type: "dog", size: "large",  amount: 349 },
      { service_id: "full", pet_type: "cat", size: null,     amount: 220 },
    ],
  },
];

// Icon background colours per service
const ICON_BG: Record<string, string> = {
  basic: "#C5DDD8", // mint / sage
  full:  "#E8D5A0", // warm gold
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  basic: (
    <Image src="/images/bath-logo.png" alt="" width={22} height={22} />
  ),
  full: (
    <Image src="/images/groom.png" alt="" width={22} height={22} />
  ),
};

// Toggle pet icons
const DogIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M2.5 5.5V9C2.5 12 5 14 8.5 14C12 14 14.5 12 14.5 9V5.5" stroke="#1C3328" strokeWidth="1.3"/>
    <path d="M2.5 5.5C2.5 5.5 1.5 3.5 3 3C4.5 2.5 4.5 5 4.5 5" stroke="#1C3328" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M14.5 5.5C14.5 5.5 15.5 3.5 14 3C12.5 2.5 12.5 5 12.5 5" stroke="#1C3328" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="6.5" cy="9" r="0.8" fill="#1C3328"/>
    <circle cx="10.5" cy="9" r="0.8" fill="#1C3328"/>
    <path d="M7.5 11.5C7.5 11.5 8 12 9.5 11.5" stroke="#1C3328" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const CatIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M4.5 3.5L2.5 1.5V6C2.5 6 2.5 6.5 3.5 7" stroke="#1C3328" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M12.5 3.5L14.5 1.5V6C14.5 6 14.5 6.5 13.5 7" stroke="#1C3328" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M3.5 7C3.5 10.5 5.8 14 8.5 14C11.2 14 13.5 10.5 13.5 7" stroke="#1C3328" strokeWidth="1.3"/>
    <circle cx="6.5" cy="9.5" r="0.8" fill="#1C3328"/>
    <circle cx="10.5" cy="9.5" r="0.8" fill="#1C3328"/>
    <path d="M8 11.5L8.5 12L9 11.5" stroke="#1C3328" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

function ServiceCard({
  service,
  petType,
}: {
  service: ServiceWithPrices;
  petType: PetType;
}) {
  const dogPrices = DOG_SIZES.map((size) => ({
    size,
    amount: service.prices.find((p) => p.pet_type === "dog" && p.size === size)?.amount,
  }));
  const catPrice = service.prices.find((p) => p.pet_type === "cat" && p.size === null)?.amount;

  const subtitle =
    service.id === "basic"
      ? "A simple grooming session to keep your pet clean, healthy, and happy."
      : "A complete grooming session for a clean, healthy, and happy pet.";

  return (
    <div className="py-7">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className="flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: ICON_BG[service.id] ?? ICON_BG.basic }}
        >
          {SERVICE_ICONS[service.id] ?? SERVICE_ICONS.basic}
        </div>
        <div>
          <h4 className="font-bold text-petra-green text-[17px] leading-tight">
            {service.name}
          </h4>
          <p className="text-sm text-petra-green/50 mt-1 leading-snug">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Feature chips — larger, bolder */}
      <div className="flex flex-wrap gap-2 mb-5">
        {service.features.map((f) => (
          <span
            key={f}
            className="rounded-full border border-[#D1CEC6] px-4 py-1.5 text-sm font-medium text-petra-green/70"
          >
            {f}
          </span>
        ))}
      </div>

      {/* Pricing — larger text. Spread edge-to-edge on mobile, original clustered gap on desktop. */}
      {petType === "dog" ? (
        <div className="flex items-center flex-wrap justify-between gap-x-4 gap-y-1 lg:justify-start lg:gap-x-7">
          {dogPrices.map(({ size, amount }) =>
            amount ? (
              <span key={size} className="text-sm">
                <span className="text-petra-green/40 mr-2">
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </span>
                <span className="font-bold text-petra-green text-[15px]">AED {amount}</span>
              </span>
            ) : null
          )}
        </div>
      ) : (
        catPrice !== undefined && (
          <span className="text-sm">
            <span className="text-petra-green/40 mr-2">Flat rate</span>
            <span className="font-bold text-petra-green text-[15px]">AED {catPrice}</span>
          </span>
        )
      )}
    </div>
  );
}

export default function ServicesSection({
  services,
}: {
  services: ServiceWithPrices[];
}) {
  const [petType, setPetType] = useState<PetType>("dog");

  const displayServices =
    services.length > 0 ? services.filter((s) => s.active) : FALLBACK_SERVICES;

  return (
    <section id="services" className="bg-white overflow-hidden scroll-mt-16">
      <div className="grid lg:grid-cols-[47%_53%]">

        {/* Left — image already has its D-shape curve baked into its alpha, left edge bleeds off-screen */}
        <div className="hidden lg:block relative">
          <div
            className="absolute z-0"
            style={{
              width: "46vw",
              aspectRatio: "664 / 964",
              left: "-8vw",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <Image
              src="/images/dog-updated.png"
              alt="Happy dog ready for grooming"
              fill
              className="object-contain object-left"
              sizes="(min-width: 1024px) 46vw, 100vw"
            />
          </div>
        </div>

        {/* Right — white content, vertically centered */}
        <div className="py-10 px-5 lg:py-14 lg:px-14 flex flex-col justify-center">

          <h2 className="font-serif font-bold text-petra-green mb-6 text-3xl sm:text-4xl lg:text-[54px] lg:leading-[1.1]">
            Tailored Grooming<br />for Every Pet
          </h2>

          {/* Dog / Cat toggle — outlined pills */}
          <div className="inline-flex items-center gap-3 mb-8 self-start">
            <button
              onClick={() => setPetType("dog")}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all border ${
                petType === "dog"
                  ? "border-petra-green/50 text-petra-green"
                  : "border-gray-200 text-petra-green/40 hover:border-petra-green/30 hover:text-petra-green"
              }`}
            >
              <DogIcon /> Dog
            </button>
            <button
              onClick={() => setPetType("cat")}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all border ${
                petType === "cat"
                  ? "border-petra-green/50 text-petra-green"
                  : "border-gray-200 text-petra-green/40 hover:border-petra-green/30 hover:text-petra-green"
              }`}
            >
              <CatIcon /> Cat
            </button>
          </div>

          {/* Service cards separated by a hairline */}
          <div className="mb-8 divide-y divide-[#EBEBEB]">
            {displayServices.map((service) => (
              <ServiceCard key={service.id} service={service} petType={petType} />
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/book"
            className="inline-flex items-center justify-center self-center lg:self-start rounded-full bg-petra-gold px-9 py-3.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            Book a Grooming
          </Link>

        </div>
      </div>
    </section>
  );
}
