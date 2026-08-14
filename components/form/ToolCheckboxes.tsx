import { BONUS_TOOLS } from "@/lib/schemas/application";

export function ToolCheckboxes() {
  return (
    <fieldset>
      <legend className="form-label">Bonus araçlar</legend>
      <p className="form-hint mb-3">
        Kullandıklarını işaretle; boş bırakabilirsin.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BONUS_TOOLS.map((tool) => (
          <label
            key={tool}
            className="group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2.5 text-sm font-medium text-[color:var(--ink)] transition hover:border-[color:var(--ink-faint)] has-checked:border-[color:var(--honey)] has-checked:bg-[color:var(--honey-tint)] has-checked:text-[color:var(--honey-deep)]"
          >
            <input
              type="checkbox"
              name="bonus_tools"
              value={tool}
              className="size-4 rounded border-[color:var(--line)] accent-[color:var(--honey)]"
            />
            <span>{tool}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
