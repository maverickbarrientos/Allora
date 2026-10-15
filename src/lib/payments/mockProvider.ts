// =============================================================================
// DEMO PAYMENT PROVIDER: REPLACE BEFORE REAL MONEY.
//
// This fake provider is the only code that decides whether a payment succeeds
// (docs/SPEC-payment.md). It moves no money and never sees card data: its only
// input is the test outcome the customer picked. "approve" succeeds with a demo
// reference; "decline" fails. A real provider would replace this file.
// =============================================================================

import { randomBytes } from "node:crypto";

export type TestMethod = "approve" | "decline";

export type ProviderResult = { approved: true; reference: string } | { approved: false };

export function isTestMethod(v: unknown): v is TestMethod {
  return v === "approve" || v === "decline";
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function demoReference() {
  const bytes = randomBytes(10);
  return "DEMO-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function charge(testMethod: TestMethod): ProviderResult {
  return testMethod === "approve" ? { approved: true, reference: demoReference() } : { approved: false };
}
