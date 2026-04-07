/** @format */

const memoryStorage = new Map<string, string>();

const encodeBase64Utf8 = (value: string): string => {
  if (typeof window === "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const decodeBase64Utf8 = (value: string): string => {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }

  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/**
 * In-memory storage utility for user progression.
 * Does not use localStorage/sessionStorage or backend persistence.
 */
export const backendStorage = (originalKey: string) => {
  const obfuscatedKey = encodeBase64Utf8(originalKey);
  const storageKey = obfuscatedKey;

  const getMemoryKey = (key: string) => `${storageKey}${encodeBase64Utf8(key)}`;

  const setItem = async (key: string, value: string) => {
    memoryStorage.set(getMemoryKey(key), encodeBase64Utf8(value));
  };

  const getItem = (key: string): string | null => {
    const item = memoryStorage.get(getMemoryKey(key));
    return item ? decodeBase64Utf8(item) : null;
  };

  const getItemAsync = async (key: string): Promise<string | null> => {
    return getItem(key);
  };

  const removeItem = async (key: string) => {
    memoryStorage.delete(getMemoryKey(key));
  };

  return {
    setItem,
    getItem,
    getItemAsync,
    removeItem,
    key: storageKey,
  };
};

export type BackendStorage = ReturnType<typeof backendStorage>;
