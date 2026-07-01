import { createClient } from "@/lib/supabase/server";
import AppointmentsManager from "@/components/admin/AppointmentsManager";

export const metadata = { title: "Appointments | Admin" };

export default async function AppointmentsPage() {
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "*, service:services(id, name, duration_minutes), zone:service_zones(id, name)"
    )
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <p className="text-muted-foreground">
          View, confirm, and manage all bookings.
        </p>
      </div>
      <AppointmentsManager initialAppointments={appointments ?? []} />
    </div>
  );
}
