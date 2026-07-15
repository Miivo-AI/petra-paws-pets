"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Service, ServicePrice, PetType, PetSize } from "@/lib/types";

const DOG_SIZES: PetSize[] = ["small", "medium", "large"];
const SIZE_LABELS: Record<PetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

interface CellKey {
  petType: PetType;
  serviceId: string;
  size: PetSize | null;
}

function cellKey(k: CellKey) {
  return `${k.petType}-${k.serviceId}-${k.size ?? "null"}`;
}

export default function PricingMatrix({
  services,
  initialPrices,
}: {
  services: Service[];
  initialPrices: ServicePrice[];
}) {
  const [prices, setPrices] = useState<ServicePrice[]>(initialPrices);
  const [editing, setEditing] = useState<string | null>(null); // cellKey being edited
  const [draftValue, setDraftValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const supabase = createClient();

  function getPrice(k: CellKey): number | null {
    const p = prices.find(
      (p) =>
        p.pet_type === k.petType &&
        p.service_id === k.serviceId &&
        p.size === k.size
    );
    return p?.amount ?? null;
  }

  function startEdit(k: CellKey) {
    const current = getPrice(k);
    setDraftValue(current !== null ? String(current) : "");
    setEditing(cellKey(k));
  }

  function saveEdit(k: CellKey) {
    const amount = parseFloat(draftValue);
    if (isNaN(amount) || amount < 0) {
      setEditing(null);
      return;
    }

    startTransition(async () => {
      const { data, error } = await supabase
        .from("service_prices")
        .upsert(
          {
            pet_type: k.petType,
            service_id: k.serviceId,
            size: k.size,
            amount,
          },
          { onConflict: "pet_type,service_id,size" }
        )
        .select()
        .single();

      if (!error && data) {
        setPrices((prev) => {
          const filtered = prev.filter(
            (p) =>
              !(
                p.pet_type === k.petType &&
                p.service_id === k.serviceId &&
                p.size === k.size
              )
          );
          return [...filtered, data as ServicePrice];
        });
        setSaved(cellKey(k));
        setTimeout(() => setSaved(null), 1500);
      }
      setEditing(null);
    });
  }

  function Cell({ k }: { k: CellKey }) {
    const key = cellKey(k);
    const price = getPrice(k);
    const isEditing = editing === key;
    const wasSaved = saved === key;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">AED</span>
          <Input
            autoFocus
            type="number"
            min={0}
            className="h-7 w-20 text-sm px-2"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(k);
              if (e.key === "Escape") setEditing(null);
            }}
            onBlur={() => saveEdit(k)}
          />
        </div>
      );
    }

    return (
      <button
        className={`w-full text-left text-sm rounded px-2 py-1 transition-colors ${
          wasSaved
            ? "bg-green-50 text-green-700"
            : "hover:bg-muted cursor-text"
        }`}
        onClick={() => startEdit(k)}
      >
        {price !== null ? (
          <span className="font-medium">{formatCurrency(price)}</span>
        ) : (
          <span className="text-muted-foreground">—  click to set</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dogs */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Dogs (priced by size)
        </h3>
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-24">
                    Size
                  </th>
                  {services.map((s) => (
                    <th
                      key={s.id}
                      className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {DOG_SIZES.map((size) => (
                  <tr key={size} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium capitalize">{SIZE_LABELS[size]}</td>
                    {services.map((s) => (
                      <td key={s.id} className="px-4 py-2.5">
                        <Cell
                          k={{ petType: "dog", serviceId: s.id, size }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cats */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Cats (flat per service)
        </h3>
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-24">
                    Pet
                  </th>
                  {services.map((s) => (
                    <th
                      key={s.id}
                      className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium">Cat</td>
                  {services.map((s) => (
                    <td key={s.id} className="px-4 py-2.5">
                      <Cell k={{ petType: "cat", serviceId: s.id, size: null }} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click any price to edit. 5% VAT is added automatically at checkout. Prices are in AED (pre-VAT).
      </p>
    </div>
  );
}
