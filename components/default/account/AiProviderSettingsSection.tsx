"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/tailwind/ui/button";
import { Input } from "@/components/tailwind/ui/input";
import { useAIProviderConfig } from "@/components/default/ai/providers/stores/aiProviderConfigStore";
import { apiUrl } from "@/lib/apiUrl";
import type { Model } from "@/components/default/ai/models/types";

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateModelUnitCost(model: Model): number {
  return (
    toNumber(model.pricing?.prompt) +
    toNumber(model.pricing?.completion) +
    toNumber(model.pricing?.request) +
    toNumber(model.pricing?.image) +
    toNumber(model.pricing?.internal_reasoning)
  );
}

function getProviderLabel(model: Model): string {
  return model.api_provider || model.id.split("/")[0] || "unknown";
}

function formatEstimatedCost(model: Model): string {
  const estimatedCost = estimateModelUnitCost(model);
  if (estimatedCost === 0) {
    return "Free";
  }
  return `$${estimatedCost.toExponential(2)}`;
}

function isFreeModel(model: Model): boolean {
  return estimateModelUnitCost(model) === 0;
}

function isTextCapableModel(model: Model): boolean {
  const modality = String(model.architecture?.modality || "").toLowerCase();
  return modality.includes("text") || modality.includes("chat") || modality.includes("language");
}

const nativeSelectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type PriceFilter = "all" | "free" | "paid" | "cheap";
type SortMode = "cheapest" | "name" | "context";

export function AiProviderSettingsSection() {
  const { config, setApiEndpoint, setModel, setApiKey, resetToDefaults } = useAIProviderConfig();
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("cheapest");
  const isOpenRouterEndpoint = config.apiEndpoint.toLowerCase().includes("openrouter.ai");

  useEffect(() => {
    if (!modelPickerOpen) return;
    if (models.length > 0 || loading) return;

    let cancelled = false;

    const loadModels = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = isOpenRouterEndpoint
          ? apiUrl("/api/ai/models/read?source=openrouter")
          : apiUrl("/api/ai/models/read");
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setModels(Array.isArray(data.models) ? data.models : []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch models");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadModels().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpenRouterEndpoint, loading, modelPickerOpen, models.length]);

  const providers = useMemo(() => {
    return Array.from(new Set(models.map(getProviderLabel))).sort((a, b) => a.localeCompare(b));
  }, [models]);

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visibleModels = models.filter((model) => {
      if (!isTextCapableModel(model)) return false;
      if (providerFilter !== "all" && getProviderLabel(model) !== providerFilter) return false;
      if (priceFilter === "free" && !isFreeModel(model)) return false;
      if (priceFilter === "paid" && isFreeModel(model)) return false;
      if (priceFilter === "cheap" && estimateModelUnitCost(model) > 0.00001) return false;
      if (!query) return true;
      const haystack = [
        model.id,
        model.name,
        model.description,
        getProviderLabel(model),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...visibleModels];
    if (sortMode === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "context") {
      sorted.sort((a, b) => (b.context_length || 0) - (a.context_length || 0));
    } else {
      sorted.sort((a, b) => {
        const costDiff = estimateModelUnitCost(a) - estimateModelUnitCost(b);
        if (costDiff !== 0) return costDiff;
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [models, priceFilter, providerFilter, search, sortMode]);

  const selectedModel = models.find((model) => model.id === config.model) || null;

  return (
    <div id="ai-settings" className="rounded-lg border bg-card p-6 space-y-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">AI Generation Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These settings are used by creator mode generation (level + editor magic actions).
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-endpoint">
          API Endpoint
        </label>
        <Input
          id="ai-endpoint"
          value={config.apiEndpoint}
          onChange={(event) => {
            setApiEndpoint(event.target.value);
            setModels([]);
            setSearch("");
            setProviderFilter("all");
            setPriceFilter("all");
          }}
          placeholder="https://openrouter.ai/api/v1"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Use any OpenAI-compatible endpoint.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-key">
          API Key
        </label>
        <Input
          id="ai-key"
          type="password"
          value={config.apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Enter API key"
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-model-picker">
          Model
        </label>
        <div className="space-y-3">
          <Button
            id="ai-model-picker"
            type="button"
            variant="outline"
            className="w-full justify-between font-mono text-sm"
            data-testid="ai-model-picker-trigger"
            onClick={() => setModelPickerOpen((open) => !open)}
          >
            <span className="truncate text-left">
              {selectedModel ? `${selectedModel.id} · ${formatEstimatedCost(selectedModel)}` : "Choose a model"}
            </span>
            {loading ? <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" /> : null}
          </Button>
          {modelPickerOpen ? (
            <div className="rounded-md border p-3">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search models"
                  data-testid="ai-model-search"
                />
                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value)}
                  className={nativeSelectClassName}
                  data-testid="ai-model-provider-filter"
                >
                  <option value="all">All providers</option>
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
                <select
                  value={priceFilter}
                  onChange={(event) => setPriceFilter(event.target.value as PriceFilter)}
                  className={nativeSelectClassName}
                  data-testid="ai-model-price-filter"
                >
                  <option value="all">All prices</option>
                  <option value="free">Free only</option>
                  <option value="cheap">Cheap only</option>
                  <option value="paid">Paid only</option>
                </select>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className={nativeSelectClassName}
                  data-testid="ai-model-sort"
                >
                  <option value="cheapest">Sort: Cheapest</option>
                  <option value="name">Sort: Name</option>
                  <option value="context">Sort: Context</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {filteredModels.length} text-capable model{filteredModels.length === 1 ? "" : "s"} shown
                </span>
                {isOpenRouterEndpoint ? <span>Live OpenRouter catalog</span> : <span>Local model catalog</span>}
              </div>

              <div className="max-h-80 overflow-auto rounded-md border">
                {error ? (
                  <div className="p-3 text-sm text-destructive">{error}</div>
                ) : null}
                {!error && !loading && filteredModels.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No matching models.</div>
                ) : null}
                <div className="divide-y">
                  {filteredModels.map((model) => {
                    const provider = getProviderLabel(model);
                    const selected = config.model === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60"
                        onClick={() => {
                          setModel(model.id);
                          setModelPickerOpen(false);
                        }}
                        data-testid={`ai-model-option-${model.id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {selected ? <Check className="h-4 w-4 text-primary" /> : <span className="h-4 w-4" />}
                            <span className="font-medium">{model.id}</span>
                          </div>
                          <div className="pl-6 text-xs text-muted-foreground">
                            <div>{model.name}</div>
                            <div className="flex flex-wrap gap-2">
                              <span>{provider}</span>
                              <span>{formatEstimatedCost(model)}</span>
                              <span>{model.context_length ? `${model.context_length.toLocaleString()} ctx` : "ctx ?"}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Search and filter by provider and price. Free models are available through the OpenRouter catalog.
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={resetToDefaults}>
          Reset to defaults
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Stored in your browser local storage for this device.
      </p>
    </div>
  );
}
