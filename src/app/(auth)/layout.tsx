import { SessionGuard } from "@/components/session-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard mode="guest">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        {children}
      </main>
    </SessionGuard>
  );
}
