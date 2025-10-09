'use client';

import React, { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

export type SignItem = {
  id: string;        // stable ID (e.g. 'door-sign-a3')
  name: string;      // human label
  src: string;       // image URL (public/ or remote)
  alt?: string;
};

type Props = {
  items: SignItem[];
  storageKey: string;
  initialSelected?: string[];
  onChange?: (selectedIds: string[]) => void;
};

export default function SignagePicker({ items, storageKey, initialSelected = [], onChange }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelected);

  // Load persisted selection once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSelected(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  // Persist & notify on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(selected));
    } catch {}
    onChange?.(selected);
  }, [selected, storageKey, onChange]);

  const isSelected = (id: string) => selected.includes(id);
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((item) => {
        const active = isSelected(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            aria-pressed={active}
            className={[
              "relative group rounded-2xl overflow-hidden border transition",
              active ? "border-[#164087] ring-2 ring-[#164087]" : "border-slate-200 hover:border-[#164087]/50"
            ].join(" ")}
          >
            <img
              src={item.src}
              alt={item.alt || item.name}
              className="aspect-square w-full object-cover"
              draggable={false}
            />
            {/* name tag */}
            <div className="absolute left-2 bottom-2 text-xs font-semibold px-2 py-1 rounded bg-white/90 text-slate-900">
              {item.name}
            </div>

            {/* hover/selected overlay */}
            <div
              className={[
                "absolute inset-0 flex items-center justify-center text-white text-sm font-semibold",
                "bg-black/0 group-hover:bg-black/40 transition"
              ].join(" ")}
            >
              {/* Idle hover (add) */}
              {!active && (
                <span className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add to basket
                </span>
              )}
            </div>

            {/* Selected state overlay */}
            {active && (
              <div className="absolute inset-0 bg-[#164087]/90 text-white flex items-center justify-center">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Check className="h-4 w-4" /> Added — click to remove
                </span>
                <span className="absolute top-2 right-2">
                  <X className="h-4 w-4" />
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

