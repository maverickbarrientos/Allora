import { SessionGuard } from "@/components/session-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard mode="guest">
      <main className="grid flex-1 grid-rows-[auto_1fr] lg:grid-cols-2 lg:grid-rows-1">
        {children}
      </main>
    </SessionGuard>
  );
}
