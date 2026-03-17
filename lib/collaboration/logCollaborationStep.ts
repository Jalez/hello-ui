function isCollaborationStepTraceEnabled(): boolean {
  const rawValue = process.env.NEXT_PUBLIC_COLLAB_STEP_TRACE;
  if (typeof rawValue !== "string") {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function logCollaborationStep(
  step: string,
  action: string,
  details?: Record<string, unknown>,
) {
  if (!isCollaborationStepTraceEnabled()) {
    return;
  }

  if (details) {
    console.log(`[COLLABORATION STEP ${step}] ${action}`, details);
    return;
  }

  console.log(`[COLLABORATION STEP ${step}] ${action}`);
}
