"use client";

import { Check, Coins } from "lucide-react";
import { useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import type { Model, ModelPricing } from "../models/types";
import { useNotificationStore } from "../../notifications";

interface BaseModel {
    id: string;
    name: string;
    provider?: string;
}

interface ModelSelectorProps {
    serviceName: string;
    availableModels: (Model | BaseModel)[];
    currentDefaultModel: string | undefined;
    onModelChange: (modelId: string) => Promise<void> | void;
    available: boolean;
    pricingType: keyof ModelPricing;
    calculateCredits: (price: string, model?: any) => number;
    serviceCategory?: string;
}

export function ModelSelector({ serviceName, availableModels, currentDefaultModel, onModelChange, available, pricingType, calculateCredits, serviceCategory }: ModelSelectorProps) {
    const [saving, setSaving] = useState(false);

    const { showSuccess, showError } = useNotificationStore();

    const handleModelChange = async (modelId: string) => {
        try {
            setSaving(true);
            await onModelChange(modelId);
            showSuccess(`Default ${serviceName} model updated`);
        } catch (error) {
            console.error("Error saving model preference:", error);
            showError("Failed to save model preference");
        } finally {
            setSaving(false);
        }
    };

    if (!availableModels.length) {
        return <span className="text-sm text-gray-500 dark:text-gray-400">No models available</span>;
    }

    const options: ComboboxOption[] = availableModels.map((model) => ({
        value: model.id,
        label: model.name,
        keywords: [model.name, model.id, model.id.split("/")[0]],
    }));

    const modelsById = new Map(availableModels.map((model) => [model.id, model]));

    return (
        <Combobox
            value={currentDefaultModel}
            onValueChange={handleModelChange}
            options={options}
            disabled={saving || !available}
            className="w-[400px]"
            contentClassName="w-[500px]"
            placeholder="Select model..."
            searchPlaceholder={`Search ${serviceName} models...`}
            emptyText="No model found."
            renderValue={(selected) => {
                const selectedById = selected ? modelsById.get(selected.value) : null;
                if (!selectedById) {
                    return "Select model...";
                }
                return (
                    <span className="truncate">
                        {selectedById.name}
                        <span className="text-xs text-gray-500 ml-2">({'provider' in selectedById && selectedById.provider ? selectedById.provider : selectedById.id.split("/")[0]})</span>
                    </span>
                );
            }}
            renderOption={(option, isSelected) => {
                const model = modelsById.get(option.value);
                if (!model) {
                    return (
                        <>
                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                            <span>{option.label}</span>
                        </>
                    );
                }

                return (
                    <>
                        <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{model.name}</span>
                                <span className="text-xs text-gray-500">{'provider' in model && model.provider ? model.provider : model.id.split("/")[0]}</span>
                            </div>
                            {'pricing' in model && model.pricing[pricingType] && typeof model.pricing[pricingType] === "string" && (
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                        {calculateCredits("", model)}
                                    </span>
                                    <Coins className="h-4 w-4 text-yellow-500" />
                                </div>
                            )}
                        </div>
                    </>
                );
            }}
        />
    );
}
