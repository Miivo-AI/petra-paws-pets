"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, CalendarOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatTime } from "@/lib/utils";
import type { Blackout } from "@/lib/types";

const EMPTY_FORM = {
  date: "",
  is_full_day: true,
  start_time: "",
  end_time: "",
  reason: "",
};

export default function AvailabilityManager({
  initialBlocked,
}: {
  initialBlocked: Blackout[];
}) {
  const [blocked, setBlocked] = useState<Blackout[]>(initialBlocked);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  // is_full_day is inferred: null times = full day
  const fullDayBlocks = blocked.filter(
    (b) => b.start_time === null && b.end_time === null
  );
  const timeBlocks = blocked.filter(
    (b) => b.start_time !== null && b.end_time !== null
  );

  function openDialog() {
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setBlocked((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("blackouts").delete().eq("id", id);
  }

  function handleSave() {
    setError(null);
    if (!form.date) {
      setError("Please select a date.");
      return;
    }
    if (!form.is_full_day) {
      if (!form.start_time || !form.end_time) {
        setError("Please set both start and end times.");
        return;
      }
      if (form.start_time >= form.end_time) {
        setError("End time must be after start time.");
        return;
      }
    }

    startTransition(async () => {
      const payload = {
        date: form.date,
        start_time: form.is_full_day ? null : form.start_time || null,
        end_time: form.is_full_day ? null : form.end_time || null,
        reason: form.reason.trim() || null,
      };

      const { data, error: err } = await supabase
        .from("blackouts")
        .insert(payload)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return;
      }

      setBlocked((prev) =>
        [...prev, data as Blackout].sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )
      );
      setDialogOpen(false);
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Block Date / Slot
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Full-day blocks */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">No-Service Days</h2>
            <Badge variant="secondary" className="ml-auto">
              {fullDayBlocks.length}
            </Badge>
          </div>
          <div className="rounded-xl border bg-white shadow-sm divide-y">
            {fullDayBlocks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No full-day blocks set.
              </p>
            ) : (
              fullDayBlocks.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{formatDate(slot.date)}</p>
                    {slot.reason && (
                      <p className="text-sm text-muted-foreground">
                        {slot.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(slot.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Partial time blocks */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Blocked Time Slots</h2>
            <Badge variant="secondary" className="ml-auto">
              {timeBlocks.length}
            </Badge>
          </div>
          <div className="rounded-xl border bg-white shadow-sm divide-y">
            {timeBlocks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No partial blocks set.
              </p>
            ) : (
              timeBlocks.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{formatDate(slot.date)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(slot.start_time!)} –{" "}
                      {formatTime(slot.end_time!)}
                      {slot.reason && ` · ${slot.reason}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(slot.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block Date or Time Slot</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="block-date">Date *</Label>
              <Input
                id="block-date"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="full-day"
                checked={form.is_full_day}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, is_full_day: v }))
                }
              />
              <Label htmlFor="full-day" className="cursor-pointer">
                Block entire day
              </Label>
            </div>

            {!form.is_full_day && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={form.start_time}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, start_time: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={form.end_time}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, end_time: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                rows={2}
                placeholder="e.g. Public holiday, Van maintenance…"
                value={form.reason}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reason: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Block Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
