"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Scissors,
  CalendarDays,
  Clock,
  LogOut,
  PawPrint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/services",
    label: "Services & Pricing",
    icon: Scissors,
  },
  {
    href: "/admin/appointments",
    label: "Appointments",
    icon: CalendarDays,
  },
  {
    href: "/admin/availability",
    label: "Availability",
    icon: Clock,
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-white">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <PawPrint className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">Petra Paws</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Management
        </p>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
