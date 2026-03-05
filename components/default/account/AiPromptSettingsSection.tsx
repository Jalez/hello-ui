"use client";

import { Button } from "@/components/tailwind/ui/button";
import { useAIPromptConfig } from "@/components/default/ai/providers/stores/aiPromptConfigStore";

interface PromptFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  description: string;
}

function PromptField({ id, label, value, onChange, description }: PromptFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-h-24 rounded-md border bg-background p-3 text-sm font-mono"
      />
    </div>
  );
}

export function AiPromptSettingsSection() {
  const {
    config,
    setLevelSystemPrompt,
    setLevelPromptTemplate,
    setEditorSystemPromptTemplate,
    setEditorPromptTemplate,
    resetToDefaults,
  } = useAIPromptConfig();

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Generation Prompts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure reusable prompt templates for level and editor generation.
          Variables: <code>{"{{levelName}}"}</code>, <code>{"{{editorType}}"}</code>.
        </p>
      </div>

      <PromptField
        id="level-system-prompt"
        label="Level System Prompt"
        value={config.levelSystemPrompt}
        onChange={setLevelSystemPrompt}
        description="High-level rules for level JSON generation."
      />

      <PromptField
        id="level-prompt-template"
        label="Level Prompt Template"
        value={config.levelPromptTemplate}
        onChange={setLevelPromptTemplate}
        description="User prompt template for generating a level."
      />

      <PromptField
        id="editor-system-prompt-template"
        label="Editor System Prompt Template"
        value={config.editorSystemPromptTemplate}
        onChange={setEditorSystemPromptTemplate}
        description="High-level rules for improving code in editor AI actions."
      />

      <PromptField
        id="editor-prompt-template"
        label="Editor Prompt Template"
        value={config.editorPromptTemplate}
        onChange={setEditorPromptTemplate}
        description="User prompt template for editor AI improvements."
      />

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={resetToDefaults}>
          Reset Prompt Defaults
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Stored in your browser local storage for this device.
      </p>
    </div>
  );
}
