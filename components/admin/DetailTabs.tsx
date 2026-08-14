"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
  badge?: number;
  content: ReactNode;
};

export function DetailTabs({
  rail,
  tabs,
}: {
  rail: ReactNode;
  tabs: Tab[];
}) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">{rail}</div>

      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--line)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`relative top-px shrink-0 rounded-t-lg border border-transparent px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
                tab.id === active?.id
                  ? "border-[color:var(--line)] border-b-[color:var(--paper)] bg-[color:var(--paper)] text-[color:var(--ink)]"
                  : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined ? (
                <span className="font-data ml-1.5 text-xs text-[color:var(--ink-faint)]">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-5 pt-6">{active?.content}</div>
      </div>
    </div>
  );
}
