import Image from "next/image";

const IMAGES = [
  { src: "/images/corousel/c1.png", alt: "Dog grooming session" },
  { src: "/images/corousel/c2.png", alt: "Groomer blow-drying a dog" },
  { src: "/images/corousel/c3.png", alt: "Cat being bathed" },
  { src: "/images/corousel/c4.png", alt: "Terrier being dried" },
  { src: "/images/corousel/c5.png", alt: "Professional groomer at work" },
];

// Duplicate for seamless infinite loop
const LOOPED = [...IMAGES, ...IMAGES];

export default function Gallery() {
  return (
    <section id="gallery" className="bg-white py-16 lg:py-20 overflow-hidden scroll-mt-16">

      {/* Heading */}
      <h2 className="font-serif text-4xl font-bold text-petra-green text-center mb-10 lg:text-5xl">
        Our Happy Clients
      </h2>

      {/* Static 2-col grid on mobile — a marquee is fiddly to read/tap on small screens */}
      <div className="grid grid-cols-2 gap-3 px-4 sm:px-6 lg:hidden">
        {IMAGES.map((img, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-2xl overflow-hidden"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              className="object-cover"
              sizes="50vw"
            />
          </div>
        ))}
      </div>

      {/* Infinite scroll strip — desktop only */}
      <div className="relative w-full overflow-hidden hidden lg:block">
        {/* Left fade */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10
                        bg-gradient-to-r from-white to-transparent" />
        {/* Right fade */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10
                        bg-gradient-to-l from-white to-transparent" />

        {/*
         * animate-marquee moves the strip left by exactly 50% (one full set of images)
         * then snaps back to 0 — creating a seamless loop.
         * Width: each image is 280px + 16px gap = 296px × 10 items = 2960px
         * translateX(-50%) = -1480px = exactly one set of 5 images
         */}
        <div
          className="animate-marquee flex gap-4"
          style={{ width: "max-content" }}
        >
          {LOOPED.map((img, i) => (
            <div
              key={i}
              className="relative flex-shrink-0 rounded-2xl overflow-hidden"
              style={{ width: 280, height: 360 }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="280px"
              />
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
