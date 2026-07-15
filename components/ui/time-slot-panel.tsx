"use client";

import { Loader2 } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

export function TimeSlotPanel({
  value,
  onChange,
  slots,
  loading,
}: {
  value: string;
  onChange: (time: string) => void;
  slots: string[];
  loading?: boolean;
}) {
  return (
    <div className="mt-2 rounded-lg border border-petra-green/15 bg-white p-3 shadow-sm">
      {loading ? (
        <div className="flex items-center justify-center py-6 text-petra-green/40">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : slots.length === 0 ? (
        <p className="py-4 text-center text-xs text-petra-green/50">
          No times available for this date.
        </p>
      ) : (
        <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-4">
          {slots.map((t) => {
            const selected = t === value;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange(t)}
                className={cn(
                  "rounded-md border py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "border-petra-gold bg-petra-gold/10 text-petra-green"
                    : "border-gray-200 text-petra-green/70 hover:border-petra-gold/40"
                )}
              >
                {formatTime(t)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
