import { ApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Error with a retry button. A 403 is not retryable, so it has no button. */
export function ErrorState({
  error,
  onRetry,
  message = "Something went wrong. Please try again.",
}: {
  error: ApiError;
  onRetry: () => void;
  message?: string;
}) {
  const forbidden = error.code === "forbidden";
  return (
    <div className="flex max-w-md flex-col items-start gap-4">
      <Alert variant="destructive">
        {forbidden ? "This area is for customers only." : message}
      </Alert>
      {!forbidden && (
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
