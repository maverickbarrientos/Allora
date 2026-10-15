"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { Role } from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthHero } from "@/components/auth-hero";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Errors = { name?: string; email?: string; password?: string; role?: string; form?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "customer", label: "Customer", hint: "Plan events and book vendors" },
  { value: "vendor", label: "Vendor", hint: "Manage incoming bookings" },
];

export default function SignupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const role = String(f.get("role") ?? "");

    const next: Errors = {};
    if (!name) next.name = "Enter your name";
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email";
    if (password.length < 8) next.password = "Password must be at least 8 characters";
    if (role !== "customer" && role !== "vendor") next.role = "Choose a role";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await api.signup({ name, email, password, role: role as Role });
      router.replace("/dashboard");
    } catch (err) {
      const { code, message } = toApiError(err);
      setErrors(
        code === "email_taken"
          ? { email: "That email is already registered" }
          : {
              form:
                code === "validation_error"
                  ? message
                  : "Something went wrong. Please try again.",
            },
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHero
        headline="Begin with a plan that feels like yours."
        line="Create an account to plan events or welcome bookings."
      />
      <section className="flex items-center px-4 py-10 sm:px-6 lg:p-16">
        <div className="mx-auto flex w-full max-w-md flex-col gap-10">
          <PageHeader
            label="Join Allora"
            title="Create your account"
            description="Join as a customer or a vendor."
          />
          <Reveal delay={700}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          {errors.form && <Alert variant="destructive">{errors.form}</Alert>}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" disabled={submitting} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" disabled={submitting} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" disabled={submitting} aria-invalid={!!errors.password} />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>
          <fieldset className="flex flex-col gap-2" disabled={submitting}>
            <legend className="label mb-2">I am a</legend>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className="flex min-h-12 cursor-pointer flex-col gap-1 rounded-xl border border-input bg-ivory p-4 text-sm text-foreground has-[:checked]:border-forest has-[:checked]:ring-2 has-[:checked]:ring-forest has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:text-ink-muted"
                >
                  <input type="radio" name="role" value={r.value} className="sr-only" />
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.hint}</span>
                </label>
              ))}
            </div>
            {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
          </fieldset>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Creating account" : "Sign up"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline">
              Log in
            </Link>
          </p>
        </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
