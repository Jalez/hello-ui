export type DiffHunkStatus = "pending" | "accepted" | "declined";

export interface DiffHunk {
  id: string;
  startOld: number;
  endOld: number;
  oldLines: string[];
  newLines: string[];
  status: DiffHunkStatus;
}

function splitLines(input: string): string[] {
  return input.split("\n");
}

export function buildLineDiffHunks(original: string, suggested: string): DiffHunk[] {
  const a = splitLines(original);
  const b = splitLines(suggested);
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const hunks: DiffHunk[] = [];
  let i = 0;
  let j = 0;
  let hunkStartOld = -1;
  let oldLines: string[] = [];
  let newLines: string[] = [];

  const flush = () => {
    if (hunkStartOld < 0) return;
    const endOld = hunkStartOld + oldLines.length;
    hunks.push({
      id: `${hunkStartOld}-${endOld}-${hunks.length}`,
      startOld: hunkStartOld,
      endOld,
      oldLines,
      newLines,
      status: "pending",
    });
    hunkStartOld = -1;
    oldLines = [];
    newLines = [];
  };

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush();
      i += 1;
      j += 1;
      continue;
    }

    if (hunkStartOld < 0) {
      hunkStartOld = i;
    }

    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      oldLines.push(a[i]);
      i += 1;
    } else {
      newLines.push(b[j]);
      j += 1;
    }
  }

  while (i < n) {
    if (hunkStartOld < 0) hunkStartOld = i;
    oldLines.push(a[i]);
    i += 1;
  }

  while (j < m) {
    if (hunkStartOld < 0) hunkStartOld = n;
    newLines.push(b[j]);
    j += 1;
  }

  flush();
  return hunks;
}

export function applyAcceptedHunks(baseCode: string, hunks: DiffHunk[]): string {
  const baseLines = splitLines(baseCode);
  const accepted = hunks.filter((h) => h.status === "accepted").sort((a, b) => a.startOld - b.startOld);
  if (accepted.length === 0) return baseCode;

  const result: string[] = [];
  let cursor = 0;

  for (const hunk of accepted) {
    result.push(...baseLines.slice(cursor, hunk.startOld));
    result.push(...hunk.newLines);
    cursor = hunk.endOld;
  }

  result.push(...baseLines.slice(cursor));
  return result.join("\n");
}
