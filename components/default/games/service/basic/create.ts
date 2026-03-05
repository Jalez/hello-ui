import { apiUrl } from "@/lib/apiUrl";
import type { Game } from "../../types";

export interface CreateGameOptions {
  mapName?: string;
  title?: string;
}

export async function createGame(options: CreateGameOptions): Promise<Game> {
  try {
    const { mapName, title = "New Game" } = options;
    const payload: Record<string, unknown> = { title };
    if (mapName && mapName.trim()) {
      payload.mapName = mapName.trim();
    }

    const response = await fetch(apiUrl("/api/games"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication required to create games");
      }
      throw new Error(`Failed to create game: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to create game:", error);
    throw error;
  }
}
