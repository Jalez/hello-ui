import { describe, expect, test } from "bun:test";
import type { Level } from "@/types";
import { finishGameCompletionHints, type PointsSnapshotForHints } from "./finishGameCompletionHints";

function levelStub(partial: Pick<Level, "name" | "maxPoints" | "scenarios"> & Partial<Level>): Level {
  return partial as Level;
}

describe("finishGameCompletionHints", () => {
  test("returns [] when levels array is empty", () => {
    expect(
      finishGameCompletionHints([], {
        allPoints: 0,
        allMaxPoints: 100,
        levels: {},
      }),
    ).toEqual([]);
  });

  test("returns [] when allMaxPoints is 0", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 0,
        scenarios: [],
      }),
    ];
    expect(
      finishGameCompletionHints(levels, {
        allPoints: 0,
        allMaxPoints: 0,
        levels: {
          "Easy card": { points: 0, maxPoints: 0, scenarios: [] },
        },
      }),
    ).toEqual([]);
  });

  test("returns [] when earned is at least 50% of max", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 100,
        scenarios: [{ scenarioId: "a", accuracy: 0, dimensions: { width: 1, height: 1 }, js: "" }],
      }),
    ];
    const points: PointsSnapshotForHints = {
      allPoints: 50,
      allMaxPoints: 100,
      levels: {
        "Easy card": {
          points: 50,
          maxPoints: 100,
          scenarios: [{ scenarioId: "a", accuracy: 100 }],
        },
      },
    };
    expect(finishGameCompletionHints(levels, points)).toEqual([]);
  });

  test("returns hints when earned is below 50% of max", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 100,
        scenarios: [{ scenarioId: "a", accuracy: 0, dimensions: { width: 1, height: 1 }, js: "" }],
      }),
    ];
    const points: PointsSnapshotForHints = {
      allPoints: 49,
      allMaxPoints: 100,
      levels: {
        "Easy card": {
          points: 49,
          maxPoints: 100,
          scenarios: [{ scenarioId: "a", accuracy: 0 }],
        },
      },
    };
    const hints = finishGameCompletionHints(levels, points);
    expect(hints.some((h) => h.includes("No points yet"))).toBe(false);
    expect(hints.some((h) => h.includes("Scenario 1") && h.includes("still at 0%"))).toBe(true);
  });

  test("flags level with zero points when under threshold", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 50,
        scenarios: [],
      }),
    ];
    const points: PointsSnapshotForHints = {
      allPoints: 0,
      allMaxPoints: 100,
      levels: {
        "Easy card": { points: 0, maxPoints: 50, scenarios: [] },
      },
    };
    expect(finishGameCompletionHints(levels, points)).toContain(
      "No points yet on level «Easy card».",
    );
  });

  test("dedupes: event sequence message replaces 0% for same scenario", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 100,
        scenarios: [{ scenarioId: "s1", accuracy: 0, dimensions: { width: 1, height: 1 }, js: "" }],
        eventSequence: {
          byScenarioId: {
            s1: [
              {
                id: "step1",
                scenarioId: "s1",
                order: 0,
                eventType: "click",
                label: "x",
                instruction: "y",
                preHash: "a",
                postHash: "b",
                snapshot: { css: "", snapshotHtml: "", width: 1, height: 1 },
                verificationSource: "dom",
              },
            ],
          },
        },
      }),
    ];
    const points: PointsSnapshotForHints = {
      allPoints: 0,
      allMaxPoints: 100,
      levels: {
        "Easy card": {
          points: 0,
          maxPoints: 100,
          scenarios: [{ scenarioId: "s1", accuracy: 0 }],
        },
      },
    };
    const hints = finishGameCompletionHints(levels, points);
    expect(hints.filter((h) => h.includes("scenario 1")).length).toBe(1);
    expect(hints.some((h) => h.includes("Interaction sequence"))).toBe(true);
    expect(hints.some((h) => h.includes("still at 0%"))).toBe(false);
  });

  test("event sequence not flagged at 100% accuracy", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 100,
        scenarios: [{ scenarioId: "s1", accuracy: 0, dimensions: { width: 1, height: 1 }, js: "" }],
        eventSequence: {
          byScenarioId: {
            s1: [
              {
                id: "step1",
                scenarioId: "s1",
                order: 0,
                eventType: "click",
                label: "x",
                instruction: "y",
                preHash: "a",
                postHash: "b",
                snapshot: { css: "", snapshotHtml: "", width: 1, height: 1 },
                verificationSource: "dom",
              },
            ],
          },
        },
      }),
    ];
    const points: PointsSnapshotForHints = {
      allPoints: 10,
      allMaxPoints: 100,
      levels: {
        "Easy card": {
          points: 10,
          maxPoints: 100,
          scenarios: [{ scenarioId: "s1", accuracy: 100 }],
        },
      },
    };
    const hints = finishGameCompletionHints(levels, points);
    expect(hints.some((h) => h.includes("Interaction sequence"))).toBe(false);
  });

  test("uses scenario 2 when second scenario is incomplete", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 100,
        scenarios: [
          { scenarioId: "a", accuracy: 0, dimensions: { width: 1, height: 1 }, js: "" },
          { scenarioId: "b", accuracy: 0, dimensions: { width: 1, height: 1 }, js: "" },
        ],
      }),
    ];
    const points: PointsSnapshotForHints = {
      allPoints: 0,
      allMaxPoints: 100,
      levels: {
        "Easy card": {
          points: 0,
          maxPoints: 100,
          scenarios: [
            { scenarioId: "a", accuracy: 100 },
            { scenarioId: "b", accuracy: 0 },
          ],
        },
      },
    };
    const hints = finishGameCompletionHints(levels, points);
    expect(hints.some((h) => h.includes("Scenario 2") && h.includes("still at 0%"))).toBe(true);
    expect(hints.some((h) => h.includes("Scenario 1"))).toBe(false);
  });

  test("99% accuracy on event sequence still nudges", () => {
    const levels = [
      levelStub({
        name: "Easy card",
        maxPoints: 100,
        scenarios: [{ scenarioId: "s1", accuracy: 0, dimensions: { width: 1, height: 1 }, js: "" }],
        eventSequence: {
          byScenarioId: {
            s1: [
              {
                id: "step1",
                scenarioId: "s1",
                order: 0,
                eventType: "click",
                label: "x",
                instruction: "y",
                preHash: "a",
                postHash: "b",
                snapshot: { css: "", snapshotHtml: "", width: 1, height: 1 },
                verificationSource: "dom",
              },
            ],
          },
        },
      }),
    ];
    const points: PointsSnapshotForHints = {
      allPoints: 10,
      allMaxPoints: 100,
      levels: {
        "Easy card": {
          points: 10,
          maxPoints: 100,
          scenarios: [{ scenarioId: "s1", accuracy: 99 }],
        },
      },
    };
    const hints = finishGameCompletionHints(levels, points);
    expect(hints.some((h) => h.includes("Interaction sequence"))).toBe(true);
  });
});
