import type { ContactField } from "@/lib/vendor-profile";
import { TextField } from "./text-field";

/** Phone, email and website on the vendor profile form (docs/SPEC-vendor-profiles.md). */
export function ContactFields({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: Record<ContactField, string>;
  errors: Partial<Record<ContactField, string>>;
  disabled: boolean;
  onChange: (field: ContactField, value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-6 border-t border-border pt-6" disabled={disabled}>
      <legend className="sr-only">Contact details</legend>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h2" aria-hidden="true">
          Contact details
        </h2>
        <p className="text-sm text-muted-foreground">
          Customers see these only after you confirm their booking.
        </p>
      </div>
      <TextField
        id="vendor-phone"
        label="Phone (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="e.g. +63 917 123 4567"
        value={values.phone}
        error={errors.phone}
        onChange={(event) => onChange("phone", event.target.value)}
      />
      <TextField
        id="vendor-email"
        label="Email (optional)"
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={(event) => onChange("email", event.target.value)}
      />
      <TextField
        id="vendor-website"
        label="Website (optional)"
        name="website"
        type="url"
        autoComplete="url"
        placeholder="https://"
        value={values.website}
        error={errors.website}
        onChange={(event) => onChange("website", event.target.value)}
      />
    </fieldset>
  );
}
