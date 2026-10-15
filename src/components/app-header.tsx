/** "Allora" wordmark on the left, actions on the right, hairline below. 48px high on mobile, 56px from 640px. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="surface-plum rounded-none border-0 border-b [border-color:var(--hairline)] p-0 shadow-none">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-14 sm:px-6">
        <span className="font-display text-2xl">Allora</span>
        <div className="flex items-center gap-4">{children}</div>
      </div>
    </div>
  );
}
