import { apiUrl } from "@/lib/apiUrl";

/**
 * Cancel the current subscription
 */
export async function cancelSubscription(): Promise<void> {
  const response = await fetch(apiUrl("/api/stripe/subscriptions/delete"), {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to cancel subscription");
  }
}
