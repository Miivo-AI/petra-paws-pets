"use client";

import { useState } from "react";
import { Search, Eye, Check, X, Clock, Wallet, CreditCard, Banknote, MessageCircle } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Appointment, BookingStatus, PaymentStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  BookingStatus,
  {
    label: string;
    variant:
      | "default"
      | "success"
      | "destructive"
      | "warning"
      | "secondary"
      | "outline";
  }
> = {
  pending_payment: { label: "Pending Payment", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large" };

export default function AppointmentsManager({
  initialAppointments,
}: {
  initialAppointments: Appointment[];
}) {
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>(
    "all"
  );
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<Appointment | null>(null);
  const supabase = createClient();

  const filtered = appointments.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      a.customer_name.toLowerCase().includes(q) ||
      a.pet_name.toLowerCase().includes(q) ||
      a.customer_email.toLowerCase().includes(q) ||
      a.booking_reference.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending_payment"
        ? a.status === "pending_payment" || a.payment_status === "unpaid"
        : a.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  async function updateStatus(id: string, status: BookingStatus) {
    const previous = appointments.find((a) => a.id === id)?.status;
    if (previous === status) return;
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    if (selectedAppt?.id === id) {
      setSelectedAppt((prev) => (prev ? { ...prev, status } : null));
    }
    const { data, error } = await supabase
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    // A row-level-security denial (e.g. an expired admin session) comes back
    // as a *successful* update of zero rows, not an `error` — so both cases
    // have to be treated as failure or the optimistic UI update silently
    // desyncs from the database.
    if ((error || !data || data.length === 0) && previous) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: previous } : a))
      );
      if (selectedAppt?.id === id) {
        setSelectedAppt((prev) => (prev ? { ...prev, status: previous } : null));
      }
      toast.error("Failed to update status. Please try again.");
      return;
    }
    toast.success(`Status changed to "${STATUS_CONFIG[status].label}"`);
  }

  async function markPaymentStatus(id: string, payment_status: PaymentStatus) {
    const previous = appointments.find((a) => a.id === id)?.payment_status;
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, payment_status } : a))
    );
    if (selectedAppt?.id === id) {
      setSelectedAppt((prev) => (prev ? { ...prev, payment_status } : null));
    }
    const { data, error } = await supabase
      .from("appointments")
      .update({ payment_status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if ((error || !data || data.length === 0) && previous) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, payment_status: previous } : a))
      );
      if (selectedAppt?.id === id) {
        setSelectedAppt((prev) =>
          prev ? { ...prev, payment_status: previous } : null
        );
      }
      toast.error("Failed to update payment status. Please try again.");
      return;
    }
    toast.success(
      payment_status === "paid" ? "Marked as paid" : "Marked as unpaid"
    );
  }

  async function applyPendingStatus() {
    if (!selectedAppt || !pendingStatus) return;
    await updateStatus(selectedAppt.id, pendingStatus);
    setPendingStatus(null);
  }

  async function deleteAppointment(id: string) {
    const target = appointments.find((a) => a.id === id);
    const snapshot = appointments;
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setSelectedAppt(null);
    setConfirmDelete(null);
    const { data, error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .select("id");
    // Same silent-failure shape as updateStatus: RLS denial returns no
    // `error`, just zero deleted rows, which must be treated as a failure.
    if (error || !data || data.length === 0) {
      setAppointments(snapshot);
      toast.error("Failed to delete appointment. Please try again.");
      return;
    }
    toast.success(
      `Booking ${target?.booking_reference ?? ""} deleted`.trim()
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, pet, email, or reference…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as "all" | BookingStatus)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Ref</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Pet</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Service</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[150px]">Date & Time</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Payment</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No appointments found.
                  </td>
                </tr>
              ) : (
                filtered.map((appt) => (
                  <tr key={appt.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {appt.booking_reference}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{appt.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {appt.customer_email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{appt.pet_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {appt.pet_type}
                        {appt.size ? ` · ${SIZE_LABELS[appt.size]}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {(appt.service as { name: string } | null)?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 min-w-[150px]">
                      <p className="whitespace-nowrap">{formatDate(appt.date)}</p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(appt.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {appt.payment_method === "pay_on_arrival" ? (
                          <Wallet className="h-3.5 w-3.5 text-petra-green/50" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5 text-petra-green/50" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {appt.payment_method === "pay_on_arrival" ? "On Arrival" : "Online"}
                        </span>
                        <Badge variant={appt.payment_status === "paid" ? "success" : "warning"}>
                          {appt.payment_status === "paid" ? "Paid" : "Unpaid"}
                        </Badge>
                        {appt.source === "whatsapp" && (
                          <span title="Booked via WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_CONFIG[appt.status].variant}>
                        {STATUS_CONFIG[appt.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View details"
                          onClick={() => {
                            setSelectedAppt(appt);
                            setPendingStatus(null);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {appt.payment_method === "pay_on_arrival" &&
                          appt.payment_status === "unpaid" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700"
                              title="Mark cash collected"
                              onClick={() => markPaymentStatus(appt.id, "paid")}
                            >
                              <Banknote className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        {appt.status === "pending_payment" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            title="Confirm manually"
                            onClick={() => updateStatus(appt.id, "confirmed")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {appt.status === "confirmed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Cancel"
                            onClick={() => updateStatus(appt.id, "cancelled")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      <Dialog
        open={!!selectedAppt}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAppt(null);
            setPendingStatus(null);
          }
        }}
      >
        {selectedAppt && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Booking{" "}
                <span className="font-mono">
                  {selectedAppt.booking_reference}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer
                  </p>
                  <p className="mt-0.5 font-medium">
                    {selectedAppt.customer_name}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedAppt.customer_email}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedAppt.customer_phone}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pet
                  </p>
                  <p className="mt-0.5 font-medium capitalize">
                    {selectedAppt.pet_name}
                    {selectedAppt.pet_breed
                      ? ` (${selectedAppt.pet_breed})`
                      : ""}
                  </p>
                  <p className="text-muted-foreground capitalize">
                    {selectedAppt.pet_type}
                    {selectedAppt.size
                      ? ` · ${SIZE_LABELS[selectedAppt.size]}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Date & Time
                  </p>
                  <p className="mt-0.5">{formatDate(selectedAppt.date)}</p>
                  <p className="text-muted-foreground">
                    {formatTime(selectedAppt.start_time)} –{" "}
                    {formatTime(selectedAppt.end_time)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Zone
                  </p>
                  <p className="mt-0.5">
                    {(selectedAppt.zone as { name: string } | null)?.name ??
                      "—"}
                  </p>
                  {selectedAppt.customer_address && (
                    <p className="text-muted-foreground text-xs">
                      {selectedAppt.customer_address}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(selectedAppt.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT (5%)</span>
                  <span>{formatCurrency(selectedAppt.vat)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                  <span>Total</span>
                  <span className="text-primary">
                    {formatCurrency(selectedAppt.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 mt-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {selectedAppt.payment_method === "pay_on_arrival" ? (
                      <Wallet className="h-3.5 w-3.5" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5" />
                    )}
                    {selectedAppt.payment_method === "pay_on_arrival"
                      ? "Pay on Arrival"
                      : "Paid Online"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={selectedAppt.payment_status === "paid" ? "success" : "warning"}
                    >
                      {selectedAppt.payment_status === "paid" ? "Paid" : "Unpaid"}
                    </Badge>
                    {selectedAppt.payment_method === "pay_on_arrival" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          markPaymentStatus(
                            selectedAppt.id,
                            selectedAppt.payment_status === "paid" ? "unpaid" : "paid"
                          )
                        }
                      >
                        {selectedAppt.payment_status === "paid"
                          ? "Mark Unpaid"
                          : "Mark Cash Collected"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {selectedAppt.special_notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Special Notes
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {selectedAppt.special_notes}
                  </p>
                </div>
              )}

              {selectedAppt.ziina_payment_id && (
                <p className="text-xs text-muted-foreground">
                  Payment ID: {selectedAppt.ziina_payment_id}
                </p>
              )}

              <div className="border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Update Status
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      "pending_payment",
                      "confirmed",
                      "cancelled",
                    ] as BookingStatus[]
                  ).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={
                        (pendingStatus ?? selectedAppt.status) === s
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setPendingStatus(
                          s === selectedAppt.status ? null : s
                        )
                      }
                    >
                      {STATUS_CONFIG[s].label}
                    </Button>
                  ))}
                  {pendingStatus && pendingStatus !== selectedAppt.status && (
                    <Button
                      size="sm"
                      className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={applyPendingStatus}
                      title="Apply status change"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t pt-3 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDelete(selectedAppt)}
                >
                  Delete Appointment
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        {confirmDelete && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete appointment?</DialogTitle>
              <DialogDescription>
                Booking{" "}
                <span className="font-mono">
                  {confirmDelete.booking_reference}
                </span>{" "}
                for {confirmDelete.customer_name} will be permanently
                deleted. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteAppointment(confirmDelete.id)}
              >
                Delete Appointment
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
