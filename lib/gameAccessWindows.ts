export type GameAccessWindow = {
  id: string;
  startsAtLocal: string;
  endsAtLocal: string;
};

export type AccessWindowEvaluation = "not_started" | "expired" | undefined;

export const DEFAULT_ACCESS_WINDOW_TIMEZONE = "Europe/Helsinki";

function pad(value: string | number): string {
  return String(value).padStart(2, "0");
}

export function normalizeAccessWindowTimeZone(value: string | null | undefined): string {
  const candidate = value?.trim() || DEFAULT_ACCESS_WINDOW_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_ACCESS_WINDOW_TIMEZONE;
  }
}

function isValidLocalDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
}

export function normalizeGameAccessWindows(value: unknown): GameAccessWindow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : crypto.randomUUID();
    const startsAtLocal = typeof candidate.startsAtLocal === "string" ? candidate.startsAtLocal.trim() : "";
    const endsAtLocal = typeof candidate.endsAtLocal === "string" ? candidate.endsAtLocal.trim() : "";

    if (!isValidLocalDateTime(startsAtLocal) || !isValidLocalDateTime(endsAtLocal)) {
      return [];
    }

    return [{ id, startsAtLocal, endsAtLocal }];
  });
}

function formatDateParts(date: Date, timeZone: string) {
  const safeTimeZone = normalizeAccessWindowTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: safeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
  };
}

export function getLocalDateTimeInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day, hour, minute } = formatDateParts(date, timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function formatUtcInstantForTimeZoneInput(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return getLocalDateTimeInTimeZone(date, timeZone);
}

export function buildDefaultAccessWindow(now = new Date(), timeZone = DEFAULT_ACCESS_WINDOW_TIMEZONE): GameAccessWindow {
  const local = getLocalDateTimeInTimeZone(now, timeZone);
  const [datePart, timePart = "09:00"] = local.split("T");
  const [hourString] = timePart.split(":");
  const startHour = Math.min(21, Math.max(0, Number(hourString) || 9));
  const endHour = Math.min(23, startHour + 2);

  return {
    id: crypto.randomUUID(),
    startsAtLocal: `${datePart}T${pad(startHour)}:00`,
    endsAtLocal: `${datePart}T${pad(endHour)}:00`,
  };
}

export function evaluateAccessWindows(options: {
  enabled: boolean;
  timeZone?: string | null;
  windows?: unknown;
  legacyStartsAt?: Date | string | null;
  legacyEndsAt?: Date | string | null;
  now?: Date;
}): AccessWindowEvaluation {
  if (!options.enabled) {
    return undefined;
  }

  const windows = normalizeGameAccessWindows(options.windows);
  if (windows.length === 0) {
    const nowMs = (options.now ?? new Date()).getTime();
    const legacyStartsAt = options.legacyStartsAt ? new Date(options.legacyStartsAt) : null;
    const legacyEndsAt = options.legacyEndsAt ? new Date(options.legacyEndsAt) : null;

    if (legacyStartsAt && !Number.isNaN(legacyStartsAt.getTime()) && nowMs < legacyStartsAt.getTime()) {
      return "not_started";
    }

    if (legacyEndsAt && !Number.isNaN(legacyEndsAt.getTime()) && nowMs > legacyEndsAt.getTime()) {
      return "expired";
    }

    return legacyStartsAt || legacyEndsAt ? undefined : "not_started";
  }

  const timeZone = normalizeAccessWindowTimeZone(options.timeZone);
  const nowLocal = getLocalDateTimeInTimeZone(options.now ?? new Date(), timeZone);
  const sortedWindows = [...windows].sort((a, b) => a.startsAtLocal.localeCompare(b.startsAtLocal));

  for (const window of sortedWindows) {
    if (nowLocal >= window.startsAtLocal && nowLocal <= window.endsAtLocal) {
      return undefined;
    }
  }

  for (const window of sortedWindows) {
    if (nowLocal < window.startsAtLocal) {
      return "not_started";
    }
  }

  return "expired";
}
