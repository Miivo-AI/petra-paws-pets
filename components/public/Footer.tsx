import Link from "next/link";
import Image from "next/image";
import InstagramIcon from "@/components/icons/InstagramIcon";
import type { CSSProperties } from "react";

const INSTAGRAM_URL = "https://www.instagram.com/petrapawspets?igsh=MXdoZGhtaWtzaHZ1Yg==";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Services",     href: "#services" },
  { label: "Reviews",      href: "#reviews" },
  { label: "Gallery",      href: "#gallery" },
  { label: "FAQ",          href: "#faq" },
];

const footerFont: React.CSSProperties = {
  fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
  fontWeight: 500,
  fontSize: 14,
  lineHeight: "150%",
  letterSpacing: "0%",
};

export default function Footer() {
  return (
    <footer className="bg-petra-green text-white" style={footerFont}>

      {/* ── Main row ── */}
      <div className="container-petra py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-start gap-10 lg:gap-16">

          {/* Left — logo + brand + tagline */}
          <div className="flex items-start gap-4">
            {/* Logo image */}
            <div className="flex-shrink-0 h-24 w-24 rounded-xl overflow-hidden">
              <Image
                src="/images/logo.png"
                alt="Petra Paws Pets logo"
                width={96}
                height={96}
                className="object-cover w-full h-full"
              />
            </div>

            <div>
              <p className="font-serif text-base font-semibold text-white leading-tight">
                Petra Paws Pet
              </p>
              <p className="mt-1 text-xs text-white/55 leading-relaxed max-w-[160px]">
                Mobile pet grooming that comes to you.
              </p>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Petra Paws Pets on Instagram"
                className="mt-2 inline-flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <InstagramIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Centre — nav links (shown after contact on mobile, matching the reference; restored to source order on desktop) */}
          <div className="order-3 lg:order-none">
            <p className="font-serif text-base font-semibold text-white mb-2 lg:hidden">
              Quick Links
            </p>
            <nav className="flex flex-wrap items-center justify-start gap-x-8 gap-y-3 lg:justify-center lg:pt-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/70 hover:text-white transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right — contact (shown before nav links on mobile; restored to source order on desktop) */}
          <div className="order-2 lg:order-none lg:pt-1">
            <p className="font-serif text-base font-semibold text-white mb-2">
              Contact Us
            </p>
            <ul className="space-y-0.5 text-xs text-white/60 leading-relaxed">
              <li>Dubai Office:</li>
              <li>Nadd Al Sheba 1, Dubai, UAE</li>    
              <li>Phone: +971 54 199 6900</li>
              <li>Email: petrapawspet@gmail.com</li>
              <li>Open: 9:00 AM – 5:00 PM</li>
            </ul>
          </div>

        </div>
      </div>

      {/* ── Copyright bar ── */}
      <div className="border-t border-white/10">
        <div className="container-petra py-4">
          <p className="text-[11px] text-white/35">
            © {new Date().getFullYear()} Petra Paws Pets. All rights reserved.
          </p>
        </div>
      </div>

    </footer>
  );
}
