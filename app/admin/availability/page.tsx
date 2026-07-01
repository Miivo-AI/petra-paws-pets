import { createClient } from "@/lib/supabase/server";
import AvailabilityManager from "@/components/admin/AvailabilityManager";

export const metadata = { title: "Availability | Admin" };

export default async function AvailabilityPage() {
  const supabase = await createClient();

  // Show upcoming blackouts only
  const { data: blackouts } = await supabase
    .from("blackouts")
    .select("*")
    .gte("date", new Date().toISOString().split("T")[0])
    .order("date", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
        <p className="text-muted-foreground">
          Block out days or time slots when you can&apos;t take appointments.
          Mondays are automatically closed.
        </p>
      </div>
      <AvailabilityManager initialBlocked={blackouts ?? []} />
    </div>
  );
}
