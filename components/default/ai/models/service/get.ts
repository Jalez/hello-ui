import { apiUrl } from "@/lib/apiUrl";
import type { Model } from "../types";

function coerceToModel(entry: any): Model {
  const id = String(entry?.id || entry?.mode || "");
  return {
    id,
    canonical_slug: id,
    hugging_face_id: "",
    name: String(entry?.name || id),
    created: Date.now(),
    description: String(entry?.description || ""),
    context_length: 0,
    architecture: {
      tokenizer: "unknown",
      instruct_type: null,
      modality: "text",
    },
    pricing: {
      prompt: "0",
      completion: "0",
      request: "0",
      image: "0",
      internal_reasoning: "0",
    },
    top_provider: {
      context_length: 0,
      max_completion_tokens: null,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: [],
    default_parameters: {},
  };
}

/**
 * Fetch all models from the API
 */
export async function getModels(): Promise<Model[]> {
  const response = await fetch(apiUrl("/api/ai/models/read"));
  if (response.ok) {
    const data = await response.json();
    return data.models;
  }

  // Backward-compatible fallback for deployments exposing only /api/ai.
  const fallbackResponse = await fetch(apiUrl("/api/ai"));
  if (!fallbackResponse.ok) {
    throw new Error(`Failed to fetch models: ${fallbackResponse.statusText}`);
  }
  const fallbackData = await fallbackResponse.json();
  if (!Array.isArray(fallbackData)) {
    return [];
  }
  return fallbackData.map(coerceToModel).filter((model) => model.id.length > 0);
}

/**
 * Fetch a single model by ID
 */
export async function getModelById(id: string): Promise<Model | null> {
  const response = await fetch(apiUrl(`/api/ai/models/${encodeURIComponent(id)}/read`));

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch model: ${response.statusText}`);
  }

  const data = await response.json();
  return data.model || null;
}

/**
 * Update models from OpenRouter API
 */
export async function updateModelsFromOpenRouter(): Promise<void> {
  const response = await fetch(apiUrl("/api/ai/models/update/create"), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to update models from OpenRouter: ${response.statusText}`);
  }
}
