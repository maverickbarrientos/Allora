import { capitalize } from "@/lib/format";

/**
 * One checkbox per category. Services in `locked` have an active booking, so
 * they stay checked and can't be unticked. Shared by the plan, create and edit
 * pages (docs/SPEC-event-services.md, "Service picker").
 */
export function ServicePicker({
  categories,
  selected,
  locked,
  disabled,
  hintId,
  onChange,
}: {
  categories: readonly string[];
  selected: readonly string[];
  locked: ReadonlySet<string>;
  disabled?: boolean;
  /** id for the "Choose at least one service" hint, so a Save button can point at it. */
  hintId?: string;
  onChange: (next: string[]) => void;
}) {
  function toggle(category: string, checked: boolean) {
    // Kept services keep their order; new ones go at the end.
    onChange(checked ? [...selected, category] : selected.filter((c) => c !== category));
  }

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="sr-only">Services for this event</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {categories.map((category) => {
          const isLocked = locked.has(category);
          return (
            <label
              key={category}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-input px-4 py-2 text-sm has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={isLocked || selected.includes(category)}
                disabled={isLocked}
                onChange={(e) => toggle(category, e.target.checked)}
              />
              <span className="font-medium">{capitalize(category)}</span>
              {isLocked && <span className="ml-auto text-xs text-muted-foreground">Has a booking</span>}
            </label>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p id={hintId} role="status" className="text-sm text-muted-foreground">
          Choose at least one service.
        </p>
      )}
    </fieldset>
  );
}
