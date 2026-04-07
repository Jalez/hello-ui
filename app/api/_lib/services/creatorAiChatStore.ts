import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { UIMessage } from "ai";

export type CreatorAiChatStatus = "idle" | "streaming" | "error";

export type CreatorAiChatRecord = {
  id: string;
  status: CreatorAiChatStatus;
  messages: UIMessage[];
  updatedAt: string;
  errorMessage?: string | null;
};

const CHAT_DIR = path.join(process.cwd(), ".creator-ai-chats");

function getChatFilePath(chatId: string) {
  const safeId = chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CHAT_DIR, `${safeId}.json`);
}

async function ensureChatDir() {
  await mkdir(CHAT_DIR, { recursive: true });
}

export async function loadCreatorAiChat(chatId: string): Promise<CreatorAiChatRecord | null> {
  try {
    const raw = await readFile(getChatFilePath(chatId), "utf8");
    const parsed = JSON.parse(raw) as CreatorAiChatRecord;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.messages)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCreatorAiChat(record: CreatorAiChatRecord): Promise<void> {
  await ensureChatDir();
  await writeFile(getChatFilePath(record.id), JSON.stringify(record, null, 2), "utf8");
}

export async function updateCreatorAiChat(
  chatId: string,
  updates: Partial<Omit<CreatorAiChatRecord, "id" | "updatedAt">>,
): Promise<CreatorAiChatRecord> {
  const existing = await loadCreatorAiChat(chatId);
  const nextRecord: CreatorAiChatRecord = {
    id: chatId,
    status: updates.status ?? existing?.status ?? "idle",
    messages: updates.messages ?? existing?.messages ?? [],
    errorMessage: updates.errorMessage ?? existing?.errorMessage ?? null,
    updatedAt: new Date().toISOString(),
  };
  await saveCreatorAiChat(nextRecord);
  return nextRecord;
}
