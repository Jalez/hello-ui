'use client';

import { useMemo, useState } from "react";

const STORAGE_KEY = "ui-designer-ai-prompt-config";

export type AIPromptConfig = {
  levelSystemPrompt: string;
  levelPromptTemplate: string;
  editorSystemPromptTemplate: string;
  editorPromptTemplate: string;
};

export const defaultPromptConfig: AIPromptConfig = {
  levelSystemPrompt:
    "You are an AI trained to assist in creating web development educational content. Return JSON with keys name, code, and solution.",
  levelPromptTemplate: "Create a level for a component named {{levelName}}.",
  editorSystemPromptTemplate:
    "You are an AI trained to assist in creating web development educational content. Generate improved {{editorType}} code.",
  editorPromptTemplate:
    "Improve the following {{editorType}} for component {{levelName}}. Prioritize readability, accessibility, and responsiveness when relevant.",
};

function loadInitialConfig(): AIPromptConfig {
  if (typeof window === "undefined") {
    return defaultPromptConfig;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaultPromptConfig;
    }
    const parsed = JSON.parse(saved) as Partial<AIPromptConfig>;
    return {
      levelSystemPrompt: parsed.levelSystemPrompt || defaultPromptConfig.levelSystemPrompt,
      levelPromptTemplate: parsed.levelPromptTemplate || defaultPromptConfig.levelPromptTemplate,
      editorSystemPromptTemplate:
        parsed.editorSystemPromptTemplate || defaultPromptConfig.editorSystemPromptTemplate,
      editorPromptTemplate: parsed.editorPromptTemplate || defaultPromptConfig.editorPromptTemplate,
    };
  } catch (error) {
    console.warn("Failed to read AI prompt config from localStorage", error);
    return defaultPromptConfig;
  }
}

export function fillPromptTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => values[key] ?? "");
}

export function useAIPromptConfig() {
  const [config, setConfig] = useState<AIPromptConfig>(loadInitialConfig);

  const updateConfig = (updates: Partial<AIPromptConfig>) => {
    setConfig((current) => {
      const next = { ...current, ...updates };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  return useMemo(
    () => ({
      config,
      setLevelSystemPrompt: (value: string) => updateConfig({ levelSystemPrompt: value }),
      setLevelPromptTemplate: (value: string) => updateConfig({ levelPromptTemplate: value }),
      setEditorSystemPromptTemplate: (value: string) =>
        updateConfig({ editorSystemPromptTemplate: value }),
      setEditorPromptTemplate: (value: string) => updateConfig({ editorPromptTemplate: value }),
      resetToDefaults: () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
        setConfig(defaultPromptConfig);
      },
    }),
    [config],
  );
}
