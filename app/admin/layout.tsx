import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata = {
  title: "Admin | Petra Paws",
};

// Authenticated, per-request admin views — never statically prerender these.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
