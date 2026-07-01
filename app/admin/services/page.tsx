import { createClient } from "@/lib/supabase/server";
import ServicesManager from "@/components/admin/ServicesManager";
import PricingMatrix from "@/components/admin/PricingMatrix";

export const metadata = { title: "Services & Pricing | Admin" };

export default async function ServicesPage() {
  const supabase = await createClient();

  const [{ data: services }, { data: prices }] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("service_prices").select("*"),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Services & Pricing</h1>
        <p className="text-muted-foreground">
          Manage your grooming services and the pricing matrix.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Services</h2>
        <ServicesManager initialServices={services ?? []} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Pricing Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Click any cell to edit the price. Dogs are priced by size; cats are
            flat per service. 5% VAT is added automatically at checkout.
          </p>
        </div>
        <PricingMatrix
          services={services ?? []}
          initialPrices={prices ?? []}
        />
      </section>
    </div>
  );
}
