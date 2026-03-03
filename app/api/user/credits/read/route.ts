import { NextResponse } from "next/server";

/**
 * University version: no paid features. Return success with zero/empty data
 * so the client does not show errors or try to enable billing.
 */
const NO_BILLING_CREDITS = {
  credits: 0,
  totalEarned: 0,
  totalUsed: 0,
  billingEnabled: false,
};

export async function GET() {
  return NextResponse.json(NO_BILLING_CREDITS);
}

export async function POST() {
  return NextResponse.json(NO_BILLING_CREDITS);
}

export async function PUT() {
  return NextResponse.json(NO_BILLING_CREDITS);
}

export async function PATCH() {
  return NextResponse.json(NO_BILLING_CREDITS);
}

export async function DELETE() {
  return NextResponse.json(NO_BILLING_CREDITS);
}
