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

export const obfuscate = (originalKey: string) => {
  const obfuscatedKey = encodeBase64Utf8(originalKey);

  const getMemoryKey = (key: string) => `${obfuscatedKey}${encodeBase64Utf8(key)}`;

  const setItem = (key: string, value: string) => {
    memoryStorage.set(getMemoryKey(key), encodeBase64Utf8(value));
  };
  const getItem = (key: string): string | null => {
    const item = memoryStorage.get(getMemoryKey(key));
    if (item === undefined) {
      return null;
    }
    return decodeBase64Utf8(item);
  };
  const removeItem = (key: string) => {
    memoryStorage.delete(getMemoryKey(key));
  };
  return {
    setItem,
    getItem,
    removeItem,
    key: obfuscatedKey,
  };
};

export type Obfuscate = ReturnType<typeof obfuscate>;
