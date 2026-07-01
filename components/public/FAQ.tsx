"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

const FAQS = [
  {
    q: "How do I book an appointment?",
    a: "You can book directly through our website by clicking the 'Book Now' button, or by contacting us via WhatsApp or phone. We recommend booking at least one week in advance for weekend sessions.",
  },
  {
    q: "What services do you offer?",
    a: "We offer Basic Grooming (bath, blow dry, nail clipping, ear cleaning, teeth brush) and Full Grooming (everything in Basic plus a haircut). Both services are available for dogs and cats.",
  },
  {
    q: "Do you handle all pet breeds?",
    a: "Yes — we groom all breeds of dogs and cats. Our groomers are trained to handle everything from small toy breeds to large working dogs, and from domestic shorthairs to long-haired Persians.",
  },
  {
    q: "What should I bring for the first visit?",
    a: "Nothing at all — our fully equipped van carries everything needed. Just make sure your pet has had water before the session and hasn't eaten a large meal in the hour before we arrive.",
  },
  {
    q: "How long does a grooming session take?",
    a: "Basic Grooming takes 60–90 minutes. Full Grooming (including a haircut) takes 90–120 minutes. Times vary slightly by breed and coat condition.",
  },
];

function AccordionItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: { q: string; a: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (bodyRef.current) {
      setHeight(isOpen ? bodyRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div className="border-b border-petra-green/15 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left group"
      >
        <span
          className={`text-sm font-semibold leading-snug transition-colors duration-200 ${
            isOpen ? "text-petra-green" : "text-petra-green/75 group-hover:text-petra-green"
          }`}
        >
          {faq.q}
        </span>

        {/* Icon: × when open, + when closed */}
        <span
          className={`flex-shrink-0 w-5 h-5 relative transition-all duration-300 ${
            isOpen ? "rotate-0 text-petra-green/50" : "text-petra-green/40 group-hover:text-petra-green/70"
          }`}
          aria-hidden
        >
          {/* Horizontal bar — always visible */}
          <span
            className="absolute inset-y-1/2 left-0 right-0 h-px bg-current -translate-y-1/2 transition-all duration-300"
          />
          {/* Vertical bar — rotates to form × when open */}
          <span
            className={`absolute inset-x-1/2 top-0 bottom-0 w-px bg-current -translate-x-1/2 transition-all duration-300 ${
              isOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
            }`}
          />
        </span>
      </button>

      {/* Animated body */}
      <div
        style={{ height, overflow: "hidden", transition: "height 300ms cubic-bezier(0.4,0,0.2,1)" }}
      >
        <div ref={bodyRef} className="pb-4 pr-8">
          <p className="text-sm leading-relaxed text-petra-green/60">
            {faq.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" style={{ backgroundColor: "#F5EDDF" }} className="py-14 px-6 lg:px-16 scroll-mt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-[42%_58%] gap-12 items-center">

          {/* Left — white dog image with rounded corners */}
          <div className="relative rounded-3xl overflow-hidden" style={{ aspectRatio: "4/4.5" }}>
            <Image
              src="/images/white-dog.png"
              alt="White fluffy dog ready for grooming"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 42vw"
            />
          </div>

          {/* Right — heading + accordion */}
          <div>
            <h2
              className="font-serif text-petra-green mb-8 text-[32px] lg:text-[48px]"
              style={{ lineHeight: 1.1, letterSpacing: "-0.02em" }}
            >
              Everything You Need to Know About our Care
            </h2>

            <div>
              {FAQS.map((faq, i) => (
                <AccordionItem
                  key={i}
                  faq={faq}
                  isOpen={open === i}
                  onToggle={() => setOpen(open === i ? -1 : i)}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
