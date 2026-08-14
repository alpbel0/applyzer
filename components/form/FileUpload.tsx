"use client";

import { useRef, useState } from "react";

import { MAX_CV_SIZE_BYTES } from "@/lib/schemas/application";

type FileUploadProps = {
  error?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
};

const ACCEPTED_TYPES = ".pdf,application/pdf";

export function FileUpload({ error, file, onFileChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function chooseFile(nextFile: File | undefined) {
    onFileChange(nextFile ?? null);
  }

  return (
    <div>
      <label className="form-label" htmlFor="cv">
        CV <span aria-hidden="true">*</span>
      </label>
      <div
        className={`mt-2 rounded-2xl border-2 border-dashed p-5 text-center transition ${
          isDragging
            ? "border-[color:var(--honey)] bg-[color:var(--honey-tint)]"
            : error
              ? "border-[color:var(--bad)] bg-[color:var(--bad-tint)]"
              : "border-[color:var(--line)] bg-[color:var(--paper)] hover:border-[color:var(--ink-faint)]"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          chooseFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          id="cv"
          name="cv"
          type="file"
          accept={ACCEPTED_TYPES}
          className="sr-only"
          aria-describedby={error ? "cv-error cv-hint" : "cv-hint"}
          aria-invalid={Boolean(error)}
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-[color:var(--ink)] text-[color:var(--paper)]">
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          </svg>
        </div>
        {file ? (
          <div>
            <p className="font-semibold text-[color:var(--ink)]">
              {file.name}
            </p>
            <p className="font-data mt-1 text-xs text-[color:var(--ink-soft)]">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-[color:var(--ink)]">
              Dosyanı buraya bırak
            </p>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
              veya bilgisayarından seç
            </p>
          </div>
        )}
        <button
          type="button"
          className="mt-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:border-[color:var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:outline-none"
          onClick={() => inputRef.current?.click()}
        >
          {file ? "Başka dosya seç" : "Dosya seç"}
        </button>
        <p id="cv-hint" className="mt-3 text-xs text-[color:var(--ink-soft)]">
          Yalnızca PDF · En fazla {MAX_CV_SIZE_BYTES / 1024 / 1024} MiB
        </p>
      </div>
      {error ? (
        <p id="cv-error" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
