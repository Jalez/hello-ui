import { useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const readCookieValue = (key: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split(";") : [];
  const targetName = `${encodeURIComponent(key)}=`;
  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (!cookie.startsWith(targetName)) {
      continue;
    }

    return decodeURIComponent(cookie.slice(targetName.length));
  }

  return null;
};

const writeCookieValue = (key: string, value: string) => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
};

// Helper function to get value from localStorage synchronously
const getStoredValue = <T>(key: string, initialValue: T): T => {
  if (typeof document === "undefined") {
    return initialValue;
  }

  const cookieValue = readCookieValue(key);
  if (!cookieValue) {
    return initialValue;
  }

  try {
    return JSON.parse(cookieValue) as T;
  } catch {
    return initialValue;
  }
};

const useSidebarPersistence = <T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] => {
  // Keep initial render deterministic between server and client.
  const [storedValue, setStoredValue] = useState(initialValue);

  useIsomorphicLayoutEffect(() => {
    // During hydration, React reuses the server-rendered value.
    // Pull the latest value from localStorage once the component mounts.
    if (typeof window !== "undefined") {
      setStoredValue(getStoredValue(key, initialValue));
    }
  }, [initialValue, key]);

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      // Handle function updates like React setState
      const resolvedValue = typeof value === "function" ? (value as (prev: T) => T)(storedValue) : value;

      // Don't store undefined values
      if (resolvedValue === undefined) {
        return;
      }

      writeCookieValue(key, JSON.stringify(resolvedValue));

      // Save state
      setStoredValue(resolvedValue);
    } catch (error) {
      console.error(`Error setting stored value for key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

export default useSidebarPersistence;
