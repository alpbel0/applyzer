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
            ? "border-[#e49626] bg-[#fff6e7]"
            : error
              ? "border-[#d85252] bg-[#fff8f8]"
              : "border-[#d7d8d4] bg-[#fbfaf6] hover:border-[#aeb2bd]"
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
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-[#16213e] text-white">
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
            <p className="font-semibold text-[#16213e]">{file.name}</p>
            <p className="mt-1 text-xs text-[#6c7485]">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-[#2e374d]">Dosyanı buraya bırak</p>
            <p className="mt-1 text-sm text-[#747c8c]">
              veya bilgisayarından seç
            </p>
          </div>
        )}
        <button
          type="button"
          className="mt-4 rounded-lg border border-[#cfd1d8] bg-white px-4 py-2 text-sm font-semibold text-[#29334a] transition hover:border-[#16213e] focus-visible:ring-2 focus-visible:ring-[#16213e] focus-visible:outline-none"
          onClick={() => inputRef.current?.click()}
        >
          {file ? "Başka dosya seç" : "Dosya seç"}
        </button>
        <p id="cv-hint" className="mt-3 text-xs text-[#747c8c]">
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
