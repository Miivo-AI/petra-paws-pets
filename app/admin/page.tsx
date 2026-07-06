import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Scissors, Wallet } from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

const STATUS_COLORS = {
  pending_payment: "warning",
  confirmed: "success",
  cancelled: "destructive",
} as const;

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: totalConfirmed },
    { count: pendingCount },
    { count: activeServices },
    { count: cashDueCount },
    { data: todayAppts },
    { data: upcomingAppts },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_payment")
      .gt("hold_expires_at", new Date().toISOString()),
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .eq("payment_method", "pay_on_arrival")
      .eq("payment_status", "unpaid"),
    supabase
      .from("appointments")
      .select("*, service:services(name), zone:service_zones(name)")
      .eq("date", today)
      .eq("status", "confirmed")
      .order("start_time"),
    supabase
      .from("appointments")
      .select("*, service:services(name), zone:service_zones(name)")
      .gt("date", today)
      .eq("status", "confirmed")
      .order("date")
      .order("start_time")
      .limit(5),
  ]);

  const stats = [
    {
      label: "Confirmed Bookings",
      value: totalConfirmed ?? 0,
      icon: CalendarDays,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Awaiting Payment",
      value: pendingCount ?? 0,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Cash to Collect",
      value: cashDueCount ?? 0,
      icon: Wallet,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Active Services",
      value: activeServices ?? 0,
      icon: Scissors,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back — here&apos;s today&apos;s overview.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's route */}
      <Card>
        <CardHeader>
          <CardTitle>
            Today&apos;s Route — {formatDate(today)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!todayAppts || todayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              No appointments today.
            </p>
          ) : (
            <div className="divide-y">
              {todayAppts.map((appt, i) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-4 py-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {appt.customer_name} · {appt.pet_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(appt.service as { name: string } | null)?.name} ·{" "}
                      {(appt.zone as { name: string } | null)?.name}
                      {appt.customer_address
                        ? ` · ${appt.customer_address}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatTime(appt.start_time)} –{" "}
                      {formatTime(appt.end_time)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(appt.total)}
                    </p>
                    {appt.payment_method === "pay_on_arrival" &&
                      appt.payment_status === "unpaid" && (
                        <Badge variant="warning" className="mt-1">
                          Collect Cash
                        </Badge>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {!upcomingAppts || upcomingAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              No upcoming appointments.
            </p>
          ) : (
            <div className="divide-y">
              {upcomingAppts.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium">
                      {appt.customer_name} · {appt.pet_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(appt.service as { name: string } | null)?.name} ·{" "}
                      {(appt.zone as { name: string } | null)?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatDate(appt.date)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(appt.start_time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
