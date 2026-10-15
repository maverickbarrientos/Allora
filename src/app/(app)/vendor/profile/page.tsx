"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, toApiError } from "@/lib/api/client";
import type { VendorProfile } from "@/lib/api/types";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { useProfile } from "@/components/app-shell";
import { useLoad } from "@/lib/use-load";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Fields = { name: string; category: string; price: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const EMPTY_FIELDS: Fields = { name: "", category: "", price: "" };
const FIELD_ERRORS: Record<keyof Fields, string> = {
  name: "Enter a name between 1 and 80 characters.",
  category: "Choose a category.",
  price: "Enter a price above 0, up to 100,000,000, with no more than 2 decimals.",
};

function fieldsFromProfile(profile: VendorProfile | null): Fields {
  return profile
    ? {
        name: profile.vendor.name,
        category: profile.vendor.category,
        price: String(profile.vendor.price),
      }
    : EMPTY_FIELDS;
}

async function loadProfileData() {
  const [categoryResult, profileResult] = await Promise.all([
    api.listCategories(),
    api.getVendorProfile().then(
      (result) => result,
      (error: unknown) => {
        const apiError = toApiError(error);
        if (apiError.code === "vendor_not_linked") return null;
        throw apiError;
      },
    ),
  ]);
  return { categories: categoryResult.categories, profile: profileResult };
}

function errorsFromMessage(message: string): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of Object.keys(FIELD_ERRORS) as (keyof Fields)[]) {
    if (new RegExp(`\\b${key}\\b`, "i").test(message)) errors[key] = FIELD_ERRORS[key];
  }
  return errors;
}

export default function VendorProfilePage() {
  const router = useRouter();
  const currentUser = useProfile();
  const isVendor = currentUser.role === "vendor";
  const { state, reload } = useLoad(loadProfileData);
  const [profileOverride, setProfileOverride] = useState<VendorProfile | null>(null);
  const [fieldDraft, setFieldDraft] = useState<Fields | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);
  const profile =
    profileOverride ?? (state.status === "loaded" ? state.data.profile : null);
  const fields = fieldDraft ?? fieldsFromProfile(profile);
  const categories = state.status === "loaded" ? state.data.categories : [];

  useEffect(() => {
    if (!isVendor) router.replace("/");
  }, [isVendor, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const errors: FieldErrors = {};
    const name = fields.name.trim();
    const numericPrice = Number(fields.price);
    if (!name || name.length > 80) errors.name = FIELD_ERRORS.name;
    if (!fields.category) errors.category = FIELD_ERRORS.category;
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(fields.price.trim()) ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0 ||
      numericPrice > 100_000_000
    ) {
      errors.price = FIELD_ERRORS.price;
    }
    setFieldErrors(errors);
    setFormError(null);
    setSaved(false);
    if (Object.keys(errors).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    let redirecting = false;
    try {
      const payload = { name, category: fields.category, price: numericPrice };
      if (profile) {
        const updated = await api.updateVendorProfile(payload);
        setProfileOverride(updated);
        setFieldDraft(fieldsFromProfile(updated));
        setSaved(true);
      } else {
        await api.createVendorProfile(payload);
        redirecting = true;
        router.replace("/vendor");
      }
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "category_locked") {
        setFieldErrors((previous) => ({
          ...previous,
          category: "Category cannot change while you have pending or confirmed bookings.",
        }));
      } else {
        const serverErrors = errorsFromMessage(apiError.message);
        setFieldErrors(serverErrors);
        if (Object.keys(serverErrors).length === 0) {
          setFormError(
            apiError.code === "profile_exists"
              ? "A profile already exists for this account. Reload to edit it."
              : "Couldn't save your profile. Please try again.",
          );
        }
      }
    } finally {
      // After a create the page is leaving, so the form stays locked until it does.
      if (!redirecting) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  if (!isVendor) return null;
  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading vendor profile" className="flex max-w-xl flex-col gap-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-3/4 max-w-sm" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <ErrorState
        error={state.error}
        onRetry={reload}
        message="Couldn't load your vendor profile. Please try again."
      />
    );
  }

  const isEdit = profile !== null;

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <PageHeader
        label="Vendor profile"
        title={isEdit ? "Edit your profile" : "Create your profile"}
        description={
          isEdit
            ? "Keep your service details up to date."
            : "Add your service so customers can find and book you."
        }
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {formError && <Alert variant="destructive">{formError}</Alert>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="vendor-name">Service name</Label>
          <Input
            id="vendor-name"
            name="name"
            autoComplete="organization"
            value={fields.name}
            disabled={saving}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "vendor-name-error" : undefined}
            onChange={(event) => {
              setFieldDraft((current) => ({
                ...(current ?? fieldsFromProfile(profile)),
                name: event.target.value,
              }));
              setFieldErrors((current) => ({ ...current, name: undefined }));
              setSaved(false);
            }}
          />
          {fieldErrors.name && <p id="vendor-name-error" className="text-sm text-destructive">{fieldErrors.name}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vendor-category">Category</Label>
          <Select
            id="vendor-category"
            name="category"
            value={fields.category}
            disabled={saving || Boolean(profile?.categoryLocked)}
            aria-invalid={Boolean(fieldErrors.category)}
            aria-describedby={
              fieldErrors.category
                ? "vendor-category-error"
                : profile?.categoryLocked
                  ? "vendor-category-note"
                  : undefined
            }
            onChange={(event) => {
              setFieldDraft((current) => ({
                ...(current ?? fieldsFromProfile(profile)),
                category: event.target.value,
              }));
              setFieldErrors((current) => ({ ...current, category: undefined }));
              setSaved(false);
            }}
          >
            <option value="" disabled>Choose a category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </Select>
          {profile?.categoryLocked && (
            <p id="vendor-category-note" className="text-sm text-muted-foreground">
              Category changes are unavailable while you have pending or confirmed bookings.
            </p>
          )}
          {fieldErrors.category && <p id="vendor-category-error" className="text-sm text-destructive">{fieldErrors.category}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vendor-price">Price</Label>
          <Input
            id="vendor-price"
            name="price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="100000000"
            value={fields.price}
            disabled={saving}
            aria-invalid={Boolean(fieldErrors.price)}
            aria-describedby={fieldErrors.price ? "vendor-price-error" : undefined}
            onChange={(event) => {
              setFieldDraft((current) => ({
                ...(current ?? fieldsFromProfile(profile)),
                price: event.target.value,
              }));
              setFieldErrors((current) => ({ ...current, price: undefined }));
              setSaved(false);
            }}
          />
          {fieldErrors.price && <p id="vendor-price-error" className="text-sm text-destructive">{fieldErrors.price}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create profile"}
          </Button>
          {saved && <p role="status" className="text-sm text-foreground">Saved</p>}
        </div>
      </form>
    </div>
  );
}
