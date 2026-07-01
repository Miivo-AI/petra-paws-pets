import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-[600px] lg:min-h-screen bg-petra-green overflow-hidden">
      {/* Background image */}
      <Image
        src="/images/hero-img.png"
        alt="Golden retriever and cat waiting by the door for grooming"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
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
            <Link
              href="/book"
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-full bg-petra-gold px-3 sm:px-7 py-3.5 text-[13px] sm:text-sm font-bold text-white shadow-md hover:bg-petra-gold-light transition-colors text-center whitespace-nowrap"
            >
              Book a Grooming
            </Link>
            <Link
              href="#services"
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-full bg-white px-3 sm:px-7 py-3.5 text-[13px] sm:text-sm font-bold text-petra-green hover:bg-white/90 transition-colors text-center whitespace-nowrap"
            >
              See Services
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
