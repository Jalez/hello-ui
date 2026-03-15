export type CollaborationEngine = "yjs";

export function getClientCollaborationEngine(): CollaborationEngine {
  return "yjs";
}

export function isYjsCollaborationEnabled(): boolean {
  return true;
}
