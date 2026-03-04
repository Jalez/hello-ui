import { NextResponse } from "next/server";

/**
 * University version: no paid features. Return success with a "no subscription"
 * shape so the client does not show errors. UI can treat this as free tier.
 */
const NO_BILLING_SUBSCRIPTION = {
  status: "active" as const,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  features: [],
  planName: undefined,
  monthlyCredits: undefined,
  pendingPlanChange: undefined,
};

export async function GET() {
  return NextResponse.json(NO_BILLING_SUBSCRIPTION);
}

export async function POST() {
  return NextResponse.json(NO_BILLING_SUBSCRIPTION);
}

export async function PUT() {
  return NextResponse.json(NO_BILLING_SUBSCRIPTION);
}

export async function PATCH() {
  return NextResponse.json(NO_BILLING_SUBSCRIPTION);
}

export async function DELETE() {
  return NextResponse.json(NO_BILLING_SUBSCRIPTION);
}
