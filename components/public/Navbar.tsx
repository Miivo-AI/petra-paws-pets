"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import InstagramIcon from "@/components/icons/InstagramIcon";
import { useBookingModalStore } from "@/lib/store/booking-modal";

const INSTAGRAM_URL = "https://www.instagram.com/petrapawspets?igsh=MXdoZGhtaWtzaHZ1Yg==";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Services", href: "#services" },
  { label: "Reviews", href: "#reviews" },
  { label: "Gallery", href: "#gallery" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const openBooking = useBookingModalStore((s) => s.open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-petra-green shadow-lg" : "bg-petra-green"
      }`}
    >
      <div className="container-petra">
        <div className="flex h-16 items-center justify-between">
          {/* Logo — intentionally taller than the navbar, bleeding over its bottom edge */}
          <Link
            href="/"
            onClick={(e) => {
              if (window.location.pathname === "/") {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex items-center shrink-0"
          >
            <Image
              src="/images/logo.png"
              alt="Petra Paws Pets"
              width={92}
              height={92}
              className="rounded-xl"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/80 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Petra Paws Pets on Instagram"
              className="text-white/80 hover:text-white transition-colors"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <button
              onClick={openBooking}
              className="inline-flex items-center gap-2 rounded-full bg-petra-gold px-5 py-2 text-sm font-semibold text-white hover:bg-petra-gold-light transition-colors"
            >
              Book a Grooming
            </button>
          </div>

          {/* Mobile CTA + hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Petra Paws Pets on Instagram"
              className="text-white/80 hover:text-white transition-colors"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <button
              onClick={openBooking}
              className="inline-flex items-center gap-2 rounded-full bg-petra-gold px-5 py-2 text-sm font-semibold text-white hover:bg-petra-gold-light transition-colors"
            >
              Book Now
            </button>
            <button
              className="text-white shrink-0"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-petra-green border-t border-white/10 px-4 pb-6 pt-4 space-y-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block text-white/80 hover:text-white py-1 text-sm"
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => {
              setMenuOpen(false);
              openBooking();
            }}
            className="block w-full text-center rounded-full bg-petra-gold px-5 py-2.5 text-sm font-semibold text-white"
          >
            Book a Grooming
          </button>
        </div>
      )}
    </header>
  );
}
