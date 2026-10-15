import { AppShell } from "@/components/app-shell";
import { SessionGuard } from "@/components/session-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard mode="protected">
      <AppShell>{children}</AppShell>
    </SessionGuard>
  );
}
