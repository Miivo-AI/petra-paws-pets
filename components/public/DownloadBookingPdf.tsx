"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Appointment } from "@/lib/types";

const GREEN: [number, number, number] = [28, 51, 40]; // petra-green
const GOLD: [number, number, number] = [196, 154, 60]; // petra-gold
const MUTED: [number, number, number] = [110, 120, 115];
const LINE: [number, number, number] = [225, 221, 209];

const STATUS_LABELS: Record<Appointment["status"], string> = {
  pending_payment: "Awaiting Payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large" };

export default function DownloadBookingPdf({ appt }: { appt: Appointment }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 48;
      const contentWidth = pageWidth - margin * 2;
      let y = 56;

      // ── Header ────────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...GREEN);
      doc.text("Petra Paws", margin, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("Mobile Pet Grooming — Booking Confirmation", margin, y + 14);

      const statusLabel = STATUS_LABELS[appt.status];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...GREEN);
      doc.text(statusLabel, pageWidth - margin, y, { align: "right" });

      y += 34;
      doc.setDrawColor(...LINE);
      doc.line(margin, y, pageWidth - margin, y);
      y += 28;

      // ── Booking reference ────────────────────────────────────
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("BOOKING REFERENCE", margin, y);
      y += 16;
      doc.setFont("courier", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...GREEN);
      doc.text(appt.booking_reference, margin, y);
      y += 32;

      // ── Two-column detail rows ───────────────────────────────
      const col2X = margin + contentWidth / 2;

      function field(label: string, value: string, x: number, yPos: number) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(label.toUpperCase(), x, yPos);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...GREEN);
        doc.text(value, x, yPos + 15);
      }

      const petLine =
        appt.pet_name + (appt.pet_breed ? ` (${appt.pet_breed})` : "");
      const petSub =
        appt.pet_type.charAt(0).toUpperCase() +
        appt.pet_type.slice(1) +
        (appt.size ? ` · ${SIZE_LABELS[appt.size]}` : "");

      field("Pet", petLine, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(petSub, margin, y + 28);

      field("Service", appt.service?.name ?? "—", col2X, y);

      y += 52;
      field("Date & Time", formatDate(appt.date), margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(`${formatTime(appt.start_time)} – ${formatTime(appt.end_time)}`, margin, y + 28);

      field("Location", appt.zone?.name ?? "—", col2X, y);
      if (appt.customer_address) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        const addrLines = doc.splitTextToSize(appt.customer_address, contentWidth / 2 - 10);
        doc.text(addrLines, col2X, y + 28);
      }

      y += 60;

      // ── Payment box ───────────────────────────────────────────
      const isPayOnArrival = appt.payment_method === "pay_on_arrival";
      const boxTop = y;
      const boxPadding = 16;
      const totalLabel = isPayOnArrival
        ? appt.payment_status === "paid"
          ? "Total Paid"
          : "Due on Arrival"
        : "Total";
      const noteText = isPayOnArrival
        ? appt.payment_status === "paid"
          ? "Payment collected on-site."
          : "You chose to pay on arrival — please have cash or card ready for the groomer."
        : appt.payment_status === "paid"
          ? "Paid online."
          : "Payment is being processed.";
      const noteLines = doc.splitTextToSize(noteText, contentWidth - boxPadding * 2);
      const boxHeight = 118 + noteLines.length * 12;

      doc.setDrawColor(...LINE);
      doc.setFillColor(250, 249, 246);
      doc.roundedRect(margin, boxTop, contentWidth, boxHeight, 6, 6, "FD");

      let py = boxTop + boxPadding + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("PAYMENT", margin + boxPadding, py);
      py += 20;

      function row(label: string, value: string, bold = false) {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(bold ? 11 : 10);
        doc.setTextColor(...(bold ? GREEN : MUTED));
        doc.text(label, margin + boxPadding, py);
        doc.text(value, pageWidth - margin - boxPadding, py, { align: "right" });
        py += bold ? 18 : 16;
      }

      row("Subtotal", formatCurrency(appt.subtotal));
      row("VAT (5%)", formatCurrency(appt.vat));
      doc.setDrawColor(...LINE);
      doc.line(margin + boxPadding, py - 6, pageWidth - margin - boxPadding, py - 6);
      py += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...GREEN);
      doc.text(totalLabel, margin + boxPadding, py);
      doc.setTextColor(...GOLD);
      doc.text(formatCurrency(appt.total), pageWidth - margin - boxPadding, py, {
        align: "right",
      });
      py += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(noteLines, margin + boxPadding, py);

      y = boxTop + boxHeight + 28;

      // ── Special notes ─────────────────────────────────────────
      if (appt.special_notes) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("SPECIAL NOTES", margin, y);
        y += 16;
        doc.setFontSize(10);
        doc.setTextColor(...GREEN);
        const notesLines = doc.splitTextToSize(appt.special_notes, contentWidth);
        doc.text(notesLines, margin, y);
        y += notesLines.length * 13;
      }

      // ── Footer ────────────────────────────────────────────────
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(
        `Generated ${new Date().toLocaleString("en-AE")} · petrapaws.com`,
        margin,
        pageHeight - 32
      );

      doc.save(`${appt.booking_reference}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full border border-petra-green/15 px-4 py-2 text-xs font-semibold text-petra-green transition-colors hover:bg-petra-green/5 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Download PDF
    </button>
  );
}
