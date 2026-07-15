"use client";

import { useEffect, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function toISODate(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().split("T")[0];
}

export function CalendarPanel({
  value,
  onChange,
  min,
  isDateDisabled,
}: {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  isDateDisabled?: (date: Date) => boolean;
}) {
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(value ? parseISO(value) : new Date())
  );

  // Re-sync the visible month only when the panel is (re)opened for a
  // given value — this mounts fresh each time it's shown, so an
  // empty dep array is correct here, not a missed-value bug.
  useEffect(() => {
    setViewMonth(startOfMonth(value ? parseISO(value) : new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minDate = min ? startOfDay(parseISO(min)) : undefined;
  const selectedDate = value ? parseISO(value) : undefined;
  const gridStart = startOfWeek(startOfMonth(viewMonth));
  const gridEnd = endOfWeek(endOfMonth(viewMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="mt-2 rounded-lg border border-petra-green/15 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="rounded-md p-1 text-petra-green/60 hover:bg-petra-cream hover:text-petra-green"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-petra-green">
          {format(viewMonth, "MMMM yyyy")}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded-md p-1 text-petra-green/60 hover:bg-petra-cream hover:text-petra-green"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-petra-green/40">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const disabled =
            !inMonth ||
            (minDate ? isBefore(day, minDate) : false) ||
            (isDateDisabled?.(day) ?? false);
          const selected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onChange(toISODate(day))}
              className={cn(
                "aspect-square rounded-md text-xs font-medium transition-colors",
                !inMonth && "invisible",
                disabled && inMonth && "cursor-not-allowed text-petra-green/20",
                !disabled && !selected && "text-petra-green/80 hover:bg-petra-cream",
                selected && "bg-petra-green text-white"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
