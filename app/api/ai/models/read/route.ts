import { NextRequest, NextResponse } from "next/server";
import { getAvailableModels } from "@/app/api/_lib/services/modelService/read";
import { fetchOpenRouterData } from "@/components/default/ai/providers/service/openRouter";
import type { Model } from "@/components/default/ai/models/types";

type OpenRouterModelEntry = {
  id?: string;
  provider?: string;
  name?: string;
  description?: string;
  context_length?: number;
  modalities?: string[];
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
    request?: string | number;
    image?: string | number;
  };
};

function mapOpenRouterModel(entry: OpenRouterModelEntry): Model {
  const id = String(entry?.id || "");
  const provider = String(entry?.provider || id.split("/")[0] || "unknown");
  const modalities = Array.isArray(entry?.modalities) ? entry.modalities.map(String) : ["text"];

  return {
    id,
    canonical_slug: id,
    hugging_face_id: "",
    name: String(entry?.name || id),
    created: Date.now(),
    description: String(entry?.description || ""),
    context_length: Number(entry?.context_length || 0),
    architecture: {
      tokenizer: provider,
      instruct_type: null,
      modality: modalities.join(", "),
    },
    pricing: {
      prompt: String(entry?.pricing?.prompt ?? "0"),
      completion: String(entry?.pricing?.completion ?? "0"),
      request: String(entry?.pricing?.request ?? "0"),
      image: String(entry?.pricing?.image ?? "0"),
      internal_reasoning: "0",
    },
    top_provider: {
      context_length: Number(entry?.context_length || 0),
      max_completion_tokens: null,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: [],
    default_parameters: {},
    api_provider: provider,
  };
}

export async function GET(request: NextRequest) {
  try {
    const source = request.nextUrl.searchParams.get("source");

    if (source === "openrouter") {
      const data = await fetchOpenRouterData();
      return NextResponse.json({
        models: data.models.map(mapOpenRouterModel).filter((model) => model.id.length > 0),
      });
    }

    const models = await getAvailableModels();
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to fetch models",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
