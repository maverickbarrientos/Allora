/** True while the customer's cancellation request waits for the vendor (docs/SPEC-customer-cancel.md). */
export const hasOpenCancelRequest = (b: { status: string; cancelRequestedAt: string | null }) =>
  b.cancelRequestedAt !== null && (b.status === "pending" || b.status === "confirmed");
