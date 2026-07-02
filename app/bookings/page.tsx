"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BookingLookupPage() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLookup() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings/lookup?ref=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Booking not found.");
        setLoading(false);
        return;
      }
      router.push(`/bookings/${data.lookup_token}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-petra-sand">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container-petra max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl font-bold text-petra-green">
              Track Your Booking
            </h1>
            <p className="mt-2 text-petra-green/60">
              Enter your booking reference and email to check its status.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-petra-green/10 bg-white p-6 shadow-sm">
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div>
              <Label htmlFor="ref" className="mb-1.5 block">
                Booking Reference
              </Label>
              <Input
                id="ref"
                placeholder="PP-XXXXXX"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lookup-email" className="mb-1.5 block">
                Email
              </Label>
              <Input
                id="lookup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleLookup}
              disabled={loading || !reference.trim() || !email.trim()}
            >
              <Search className="h-4 w-4" />
              {loading ? "Searching…" : "Find Booking"}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
