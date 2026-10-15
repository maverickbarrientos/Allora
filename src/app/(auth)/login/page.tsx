"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthHero } from "@/components/auth-hero";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Errors = { email?: string; password?: string; form?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");

    const next: Errors = {};
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email";
    if (!password) next.password = "Enter your password";
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    try {
      await api.login({ email, password });
      router.replace("/dashboard");
    } catch (err) {
      const { code, message } = toApiError(err);
      setErrors({
        form:
          code === "invalid_credentials"
            ? "Wrong email or password"
            : code === "validation_error"
              ? message
              : "Something went wrong. Please try again.",
      });
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHero
        headline="Your event, thoughtfully planned."
        line="Plan your event and book the people who make it."
      />
      <section className="flex items-center px-4 py-10 sm:px-6 lg:p-16">
        <div className="mx-auto flex w-full max-w-md flex-col gap-10">
          <PageHeader
            label="Welcome back"
            title="Log in"
            description="Pick up where you left off."
          />
          <Reveal delay={700}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          {errors.form && <Alert variant="destructive">{errors.form}</Alert>}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" disabled={submitting} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" disabled={submitting} aria-invalid={!!errors.password} />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Logging in" : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline">
              Sign up
            </Link>
          </p>
        </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
