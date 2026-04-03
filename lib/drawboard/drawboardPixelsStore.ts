/**
 * Latest drawing/solution ImageData per scenario from drawboard iframe "pixels" messages.
 * Mirrors LevelUpdater state so consumers (e.g. event-sequence step accuracy) can run the
 * same comparison as ScenarioUpdater without prop drilling.
 */

type PixelPair = {
  drawing: ImageData | null;
  solution: ImageData | null;
};

const pairsByScenario = new Map<string, PixelPair>();
const serialByScenario = new Map<string, number>();
const listenersByScenario = new Map<string, Set<() => void>>();

export function subscribeDrawboardPixelsForScenario(
  scenarioId: string,
  listener: () => void,
): () => void {
  let set = listenersByScenario.get(scenarioId);
  if (!set) {
    set = new Set();
    listenersByScenario.set(scenarioId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      listenersByScenario.delete(scenarioId);
    }
  };
}

export function notifyDrawboardPixels(
  scenarioId: string,
  side: "drawing" | "solution",
  data: ImageData,
): void {
  let pair = pairsByScenario.get(scenarioId);
  if (!pair) {
    pair = { drawing: null, solution: null };
  }
  if (side === "drawing") {
    pair.drawing = data;
  } else {
    pair.solution = data;
  }
  pairsByScenario.set(scenarioId, pair);
  serialByScenario.set(scenarioId, (serialByScenario.get(scenarioId) ?? 0) + 1);
  listenersByScenario.get(scenarioId)?.forEach((l) => l());
}

export function getDrawboardPixelsPair(scenarioId: string): PixelPair {
  return pairsByScenario.get(scenarioId) ?? { drawing: null, solution: null };
}

/** Drop solution-side buffers after the live solution iframe is unmounted (e.g. game mode). */
export function clearStoredSolutionSide(scenarioId: string): void {
  const pair = pairsByScenario.get(scenarioId);
  if (!pair || !pair.solution) {
    return;
  }
  pair.solution = null;
  pairsByScenario.set(scenarioId, pair);
  serialByScenario.set(scenarioId, (serialByScenario.get(scenarioId) ?? 0) + 1);
  listenersByScenario.get(scenarioId)?.forEach((l) => l());
}

export function clearDrawboardPixelsStore(): void {
  pairsByScenario.clear();
  serialByScenario.clear();
  listenersByScenario.clear();
}
