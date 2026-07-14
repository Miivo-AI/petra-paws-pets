"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const REVIEWS = [
  {
    name: "Omar K.",
    pet: "Luna • Persian Cat",
    rating: 5,
    text: "Luna is usually so anxious but the groomer was incredibly gentle and patient. She came back calm and beautifully fluffed. Booking was easy on WhatsApp and the van arrived exactly on time.",
    image: "/images/testimonial-images/cat1.jpg",
  },
  {
    name: "Sarah Al Mansoori",
    pet: "Max • Golden Retriever",
    rating: 5,
    text: "My golden retriever Max used to shake the whole car ride to the salon. Now the van parks downstairs and he's completely relaxed. The results are incredible every single time.",
    image: "/images/testimonial-images/dog3.webp",
  },
  {
    name: "Priya Sharma",
    pet: "Luna & Mochi • Cats",
    rating: 5,
    text: "I have two cats that are notoriously difficult to handle. Petra Paws were patient, professional, and incredibly caring. No cages, no other animals — it made all the difference.",
    image: "/images/testimonial-images/cat2.webp",
  },
  {
    name: "James O'Brien",
    pet: "Buddy • Labrador",
    rating: 5,
    text: "Booking took literally 2 minutes on my phone. The groomer arrived on time, did an amazing job, and left everything spotless. Highly recommend to anyone in Meydan.",
    image: "/images/testimonial-images/dog2.webp",
  },
  {
    name: "Fatima Al Zaabi",
    pet: "Coco • Poodle Mix",
    rating: 5,
    text: "I was sceptical about mobile grooming but Petra Paws completely changed my mind. Professional equipment, a genuine love for animals, and you can see your pet the entire time.",
    image: "/images/testimonial-images/dog1.jpeg",
  },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % REVIEWS.length);
  }, []);

  useEffect(() => {
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next]);

  return (
    <section id="reviews" className="relative bg-white py-20 lg:py-28 overflow-hidden scroll-mt-16">

      {/* ── Decorative mint circles ── */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 rounded-full"
        style={{ width: 260, height: 260, backgroundColor: "#C8DDD8", opacity: 0.45 }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 rounded-full"
        style={{ width: 300, height: 300, backgroundColor: "#C8DDD8", opacity: 0.35 }}
      />
      <div
        className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 110, height: 110, backgroundColor: "#C8DDD8", opacity: 0.4 }}
      />

      <div className="relative container-petra">

        {/* Heading */}
        <h2 className="font-serif text-4xl font-bold text-petra-green text-center mb-14 lg:text-5xl">
          Loved Across Dubai
        </h2>

        {/* Review card — sliding track */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {REVIEWS.map((review, i) => (
              <div key={i} className="w-full flex-shrink-0 px-6" aria-hidden={i !== current}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-14 max-w-3xl mx-auto">
                  {/* Circle photo */}
                  <div
                    className="relative flex-shrink-0 rounded-full overflow-hidden ring-4 ring-white shadow-lg"
                    style={{ width: 220, height: 220 }}
                  >
                    <Image
                      src={review.image}
                      alt={review.name}
                      fill
                      className="object-cover object-center"
                      sizes="220px"
                    />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    {/* Name */}
                    <p className="font-serif text-xl font-bold text-petra-green">
                      {review.name}
                    </p>

                    {/* Pet info */}
                    <p className="mt-1 text-sm text-petra-green/55">
                      {review.pet}
                    </p>

                    {/* Hearts */}
                    <div className="flex items-center justify-center sm:justify-start gap-1 mt-3">
                      {Array.from({ length: review.rating }).map((_, h) => (
                        <svg key={h} width="20" height="20" viewBox="0 0 20 20" fill="#E8414A">
                          <path d="M10 17.5S2 12 2 6.5A4 4 0 0 1 10 4.5 4 4 0 0 1 18 6.5C18 12 10 17.5 10 17.5Z" />
                        </svg>
                      ))}
                    </div>

                    {/* Quote */}
                    <p className="mt-4 text-sm leading-relaxed text-petra-green/70 max-w-sm mx-auto sm:mx-0">
                      &ldquo;{review.text}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2.5 mt-10">
          {REVIEWS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Review ${i + 1}`}
              className="transition-all duration-300"
              style={{
                width: i === current ? 10 : 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: i === current ? "#1C3328" : "transparent",
                border: i === current ? "none" : "1.5px solid #9CA3AF",
              }}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
