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
            className="group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-[#dedfdc] bg-[#fbfaf6] px-3 py-2.5 text-sm font-medium text-[#3e4658] transition hover:border-[#c9c8c1] has-checked:border-[#e9a23b] has-checked:bg-[#fff6e7] has-checked:text-[#7a4300]"
          >
            <input
              type="checkbox"
              name="bonus_tools"
              value={tool}
              className="size-4 rounded border-[#b9bdc7] accent-[#e49626]"
            />
            <span>{tool}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
