import { NextRequest, NextResponse } from "next/server";
import { getLtiSession, hasOutcomeService, isInIframe } from "@/lib/lti";
import { submitOutcomeServiceGrade } from "@/lib/lti/gradeSubmission";

export async function POST(request: NextRequest) {
  try {
    const session = await getLtiSession();

    if (!session) {
      return NextResponse.json({
        success: false,
        error: "No LTI session found. Please launch from A+.",
      }, { status: 401 });
    }

    if (!hasOutcomeService(session)) {
      return NextResponse.json({
        success: false,
        error: "Grade submission is not available. The LTI launch did not include outcome service information.",
      }, { status: 400 });
    }

    const body = await request.json();
    const points = parseFloat(body.points) || 0;
    const maxPoints = parseFloat(body.maxPoints) || 100;

    if (points < 0 || maxPoints <= 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid points values.",
      }, { status: 400 });
    }

    const baseOutcomeService = session.outcomeService!;

    const result = await submitOutcomeServiceGrade(baseOutcomeService, points, maxPoints, {
      isInIframe: isInIframe(session),
    });

    if (result.success) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result, { status: 500 });
  } catch (error) {
    console.error("Error submitting grade:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
