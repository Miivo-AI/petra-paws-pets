"use client";

import { useEffect } from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { useBookingModalStore } from "@/lib/store/booking-modal";

export default function BookPage() {
  const open = useBookingModalStore((s) => s.open);

  useEffect(() => {
    open();
  }, [open]);

  return (
    <div className="min-h-screen bg-petra-sand">
      <Navbar />
      <Footer />
    </div>
  );
}
