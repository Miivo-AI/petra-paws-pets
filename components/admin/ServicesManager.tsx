"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Check, GripVertical } from "lucide-react";
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
import type { Service } from "@/lib/types";

const EMPTY_SERVICE: Omit<Service, "id" | "created_at" | "updated_at"> = {
  name: "",
  description: "",
  features: [],
  duration_minutes: 90,
  active: true,
  image_url: null,
  sort_order: 0,
};

export default function ServicesManager({
  initialServices,
}: {
  initialServices: Service[];
}) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<
    Partial<Service> & { features: string[] }
  >({ ...EMPTY_SERVICE });
  const [isEditing, setIsEditing] = useState(false);
  const [featureInput, setFeatureInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function openCreate() {
    setEditingService({ ...EMPTY_SERVICE });
    setIsEditing(false);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService({ ...service });
    setIsEditing(true);
    setError(null);
    setDialogOpen(true);
  }

  function addFeature() {
    const trimmed = featureInput.trim();
    if (!trimmed) return;
    setEditingService((prev) => ({
      ...prev,
      features: [...(prev.features ?? []), trimmed],
    }));
    setFeatureInput("");
  }

  function removeFeature(index: number) {
    setEditingService((prev) => ({
      ...prev,
      features: (prev.features ?? []).filter((_, i) => i !== index),
    }));
  }

  async function handleToggleActive(service: Service) {
    const updated = { ...service, active: !service.active };
    setServices((prev) => prev.map((s) => (s.id === service.id ? updated : s)));
    await supabase
      .from("services")
      .update({ active: updated.active })
      .eq("id", service.id);
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this service? Its pricing entries will also be removed. This cannot be undone."
      )
    )
      return;
    setServices((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("services").delete().eq("id", id);
  }

  function handleSave() {
    setError(null);
    if (!editingService.name?.trim()) {
      setError("Service name is required.");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: editingService.name!.trim(),
        description: editingService.description ?? null,
        features: editingService.features ?? [],
        duration_minutes: Number(editingService.duration_minutes) || 90,
        active: editingService.active ?? true,
        image_url: editingService.image_url ?? null,
        sort_order: editingService.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      };

      if (isEditing && editingService.id) {
        const { data, error: err } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id)
          .select()
          .single();

        if (err) { setError(err.message); return; }
        setServices((prev) =>
          prev.map((s) => (s.id === editingService.id ? data : s))
        );
      } else {
        const { data, error: err } = await supabase
          .from("services")
          .insert(payload)
          .select()
          .single();

        if (err) { setError(err.message); return; }
        setServices((prev) => [...prev, data]);
      }

      setDialogOpen(false);
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="rounded-xl border bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {service.name}
                  </h3>
                  <Badge
                    variant={service.active ? "success" : "secondary"}
                    className="text-xs"
                  >
                    {service.active ? "Active" : "Hidden"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {service.duration_minutes} min
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(service)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(service.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {service.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {service.description}
              </p>
            )}

            {service.features.length > 0 && (
              <ul className="mt-3 space-y-1">
                {service.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-sm">
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center gap-2 border-t pt-3">
              <Switch
                checked={service.active}
                onCheckedChange={() => handleToggleActive(service)}
                id={`active-${service.id}`}
              />
              <Label
                htmlFor={`active-${service.id}`}
                className="text-sm cursor-pointer"
              >
                {service.active ? "Visible to customers" : "Hidden"}
              </Label>
            </div>
          </div>
        ))}

        {services.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed bg-white p-12 text-center">
            <GripVertical className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No services yet.
            </p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Service" : "New Service"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="svc-name">Service Name *</Label>
                <Input
                  id="svc-name"
                  value={editingService.name ?? ""}
                  onChange={(e) =>
                    setEditingService((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Full Grooming"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="svc-duration">Duration (min)</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min={15}
                  step={15}
                  value={editingService.duration_minutes ?? 90}
                  onChange={(e) =>
                    setEditingService((p) => ({
                      ...p,
                      duration_minutes: parseInt(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="svc-sort">Sort Order</Label>
                <Input
                  id="svc-sort"
                  type="number"
                  min={0}
                  value={editingService.sort_order ?? 0}
                  onChange={(e) =>
                    setEditingService((p) => ({
                      ...p,
                      sort_order: parseInt(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="svc-desc">Description</Label>
                <Textarea
                  id="svc-desc"
                  rows={2}
                  value={editingService.description ?? ""}
                  onChange={(e) =>
                    setEditingService((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Visible to customers on the booking page…"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Features / What&apos;s Included</Label>
                <div className="flex gap-2">
                  <Input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder="e.g. Blow dry & brush out"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFeature();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {(editingService.features ?? []).length > 0 && (
                  <ul className="space-y-1">
                    {(editingService.features ?? []).map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1"
                      >
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="flex-1">{f}</span>
                        <button
                          type="button"
                          onClick={() => removeFeature(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="col-span-2 flex items-center gap-3">
                <Switch
                  id="svc-active"
                  checked={editingService.active ?? true}
                  onCheckedChange={(v) =>
                    setEditingService((p) => ({ ...p, active: v }))
                  }
                />
                <Label htmlFor="svc-active" className="cursor-pointer">
                  Visible to customers
                </Label>
              </div>
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
              {isPending
                ? "Saving…"
                : isEditing
                ? "Save Changes"
                : "Create Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
