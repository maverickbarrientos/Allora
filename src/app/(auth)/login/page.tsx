"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      router.replace("/");
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
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back to Allora.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
      </CardContent>
    </Card>
  );
}
