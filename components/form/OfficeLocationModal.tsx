"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

const OFFICE_ADDRESS = "Balgat, Osmanlı Cd. No: 32 D:C, 06420 Çankaya/Ankara";
const MAPS_URL = "https://share.google/pjkfsTFeGudKlrSNA";
const MAP_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(OFFICE_ADDRESS)}&output=embed`;

export function OfficeLocationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], iframe, [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        onClick={() => setIsOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        Ofis konumunu gör
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="office-location-title"
            className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-[color:var(--surface)] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.14em] text-[color:var(--honey-deep)] uppercase">
                  Ankara · Balgat
                </p>
                <h2
                  id="office-location-title"
                  className="font-display text-2xl text-[color:var(--ink)]"
                >
                  Kovan ofisi
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Konum penceresini kapat"
                className="flex size-10 items-center justify-center rounded-full bg-[color:var(--paper)] text-xl text-[color:var(--ink)] hover:bg-[color:var(--line)] focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:outline-none"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
            <iframe
              title="Kovan ofis konumu"
              src={MAP_EMBED_URL}
              className="h-72 w-full border-y border-[color:var(--line)]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-sm leading-6 text-[color:var(--ink-soft)]">
                {OFFICE_ADDRESS}
              </p>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--ink)] px-5 text-sm font-semibold text-[color:var(--paper)] hover:bg-[#0b0d13] focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Google Maps’te aç ↗
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
