export type CollaborationEngine = "custom" | "yjs";

export function getClientCollaborationEngine(): CollaborationEngine {
  return process.env.NEXT_PUBLIC_COLLAB_ENGINE === "yjs" ? "yjs" : "custom";
}

export function isYjsCollaborationEnabled(): boolean {
  return getClientCollaborationEngine() === "yjs";
}
