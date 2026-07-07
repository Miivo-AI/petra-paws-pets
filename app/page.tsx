import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/public/Navbar";
import Hero from "@/components/public/Hero";
import TrustBar from "@/components/public/TrustBar";
import ServicesSection from "@/components/public/ServicesSection";
import HowItWorks from "@/components/public/HowItWorks";
import Testimonials from "@/components/public/Testimonials";
import Gallery from "@/components/public/Gallery";
import FAQ from "@/components/public/FAQ";
import CTASection from "@/components/public/CTASection";
import Footer from "@/components/public/Footer";
import ScrollReveal from "@/components/public/ScrollReveal";

export const revalidate = 60;

export default async function HomePage() {
  let servicesWithPrices: {
    id: string;
    name: string;
    duration_minutes: number;
    features: string[];
    active: boolean;
    prices: { service_id: string; pet_type: string; size: string | null; amount: number }[];
  }[] = [];

  try {
    const supabase = await createClient();

    const [{ data: services }, { data: prices }] = await Promise.all([
      supabase
        .from("services")
        .select("id, name, duration_minutes, features, active")
        .eq("active", true)
        .order("duration_minutes", { ascending: true }),
      supabase
        .from("service_prices")
        .select("service_id, pet_type, size, amount"),
    ]);

    servicesWithPrices = (services ?? []).map((service) => ({
      ...service,
      features: Array.isArray(service.features) ? service.features : [],
      prices: (prices ?? []).filter((p) => p.service_id === service.id),
    }));
  } catch {
    // Supabase not configured yet — page renders with fallback data
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <ScrollReveal>
        <TrustBar />
      </ScrollReveal>
      <ScrollReveal>
        <ServicesSection services={servicesWithPrices} />
      </ScrollReveal>
      <ScrollReveal>
        <HowItWorks />
      </ScrollReveal>
      <ScrollReveal>
        <Testimonials />
      </ScrollReveal>
      <ScrollReveal>
        <Gallery />
      </ScrollReveal>
      <ScrollReveal>
        <FAQ />
      </ScrollReveal>
      <ScrollReveal>
        <CTASection />
      </ScrollReveal>
      <ScrollReveal>
        <Footer />
      </ScrollReveal>
    </div>
  );
}
