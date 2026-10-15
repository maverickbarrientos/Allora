import { SessionGuard } from "@/components/session-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SessionGuard mode="protected">{children}</SessionGuard>;
}
