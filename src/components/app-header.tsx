/** "Allora" wordmark on the left, actions on the right, hairline below. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <span className="font-display text-2xl">Allora</span>
        <div className="flex items-center gap-4">{children}</div>
      </div>
    </div>
  );
}
