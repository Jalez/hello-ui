"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/tailwind/ui/button";
import { Input } from "@/components/tailwind/ui/input";
import { useAIProviderConfig } from "@/components/default/ai/providers/stores/aiProviderConfigStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/tailwind/ui/select";
import { useModelsStore } from "@/components/default/ai/models/stores/modelsStore";
import type { Model } from "@/components/default/ai/models/types";

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateModelUnitCost(model: Model): number {
  // Approximate "cheapness" for sorting using available unit-price fields.
  return (
    toNumber(model.pricing?.prompt) +
    toNumber(model.pricing?.completion) +
    toNumber(model.pricing?.request) +
    toNumber(model.pricing?.image) +
    toNumber(model.pricing?.internal_reasoning)
  );
}

export function AiProviderSettingsSection() {
  const { config, setApiEndpoint, setModel, setApiKey, resetToDefaults } = useAIProviderConfig();
  const { models, loading, error, fetchModels } = useModelsStore();
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const hasApiKey = config.apiKey.trim().length > 0;

  useEffect(() => {
    if (!modelSelectOpen) return;
    if (!hasApiKey) return;
    if (models.length > 0 || loading) return;
    fetchModels().catch(() => {
      // store handles error state
    });
  }, [modelSelectOpen, hasApiKey, models.length, loading, fetchModels]);

  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => estimateModelUnitCost(a) - estimateModelUnitCost(b));
  }, [models]);

  const hasCurrentModelInList = sortedModels.some((model) => model.id === config.model);
  const modelValue = config.model
    ? (hasCurrentModelInList ? config.model : "__custom__")
    : "__none__";

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
          onChange={(event) => setApiEndpoint(event.target.value)}
          placeholder="https://openrouter.ai/api/v1"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Use any OpenAI-compatible endpoint.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-model">
          Model
        </label>
        <Select
          open={modelSelectOpen}
          onOpenChange={(nextOpen) => {
            if (!hasApiKey) {
              setModelSelectOpen(false);
              return;
            }
            setModelSelectOpen(nextOpen);
          }}
          value={modelValue}
          disabled={!hasApiKey}
          onValueChange={(value) => {
            if (value === "__none__") {
              setModel("");
              return;
            }
            if (value === "__custom__") {
              return;
            }
            setModel(value);
          }}
        >
          <SelectTrigger id="ai-model" className="font-mono text-sm">
            <SelectValue placeholder={hasApiKey ? "Choose a model" : "Add API key to load models"} />
            {loading && hasApiKey && (
              <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </SelectTrigger>
          <SelectContent>
            {!hasApiKey ? (
              <SelectItem value="__key_required__" disabled>
                Add API key first
              </SelectItem>
            ) : (
              <>
                <SelectItem value="__none__">Manual / unset model</SelectItem>
                {!loading && sortedModels.length === 0 && (
                  <SelectItem value="__empty__" disabled>
                    No models found
                  </SelectItem>
                )}
                {!hasCurrentModelInList && config.model && (
                  <SelectItem value="__custom__">{config.model} · current</SelectItem>
                )}
                {sortedModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.id} · ${estimateModelUnitCost(model).toExponential(2)}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Models load on first open and are cached for this session, sorted by lowest estimated unit cost.
        </p>
        {!hasApiKey && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Add an API key before selecting models.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
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
