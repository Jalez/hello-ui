'use client';

import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAppSelector } from "@/store/hooks/hooks";
import { chatGPTURl } from "@/constants";
import { useAIProviderConfig } from "@/components/default/ai/providers/stores/aiProviderConfigStore";
import {
  fillPromptTemplate,
  useAIPromptConfig,
} from "@/components/default/ai/providers/stores/aiPromptConfigStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

export type EditorMagicSuggestionTarget = "template" | "solution";
export type EditorMagicSuggestion = {
  code: string;
  target: EditorMagicSuggestionTarget;
};

type EditorMagicButtonProps = {
  answerKey?: string;
  EditorCode: string;
  onSuggestion?: (suggestion: EditorMagicSuggestion) => void;
  editorCodeChanger?: (newCode: string) => void;
  editorType: string;
  defaultTarget?: EditorMagicSuggestionTarget;
  disabled?: boolean;
  newPrompt?: string;
  newSystemPrompt?: string;
  exampleResponse?: string;
  buttonColor?: string;
};

// function formatHtmlString(escapedHtml: string) {
//   // Unescape HTML-specific characters and remove unnecessary backslashes
//   let formattedHtml = escapedHtml
//     .replace(/\\n/g, "\n") // Replace escaped newlines with actual newlines
//     .replace(/\\\"/g, '"') // Replace escaped double quotes with actual double quotes
//     .replace(/\\\\/g, "\\"); // Replace double backslashes with a single backslash

//   return formattedHtml;
// }

function inferSuggestionTarget(requestPrompt: string, currentTarget: EditorMagicSuggestionTarget): EditorMagicSuggestionTarget {
  const prompt = requestPrompt.toLowerCase();
  const mentionsTemplate = /\btemplate\b/.test(prompt);
  const mentionsSolution = /\bsolution\b/.test(prompt);

  if (mentionsTemplate && !mentionsSolution) {
    return "template";
  }
  if (mentionsSolution && !mentionsTemplate) {
    return "solution";
  }

  return currentTarget;
}

function parseAiJsonResponse(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  const candidates = [trimmed];

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.unshift(fencedMatch[1].trim());
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    candidates.push(objectMatch[0].trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore parse failures and try the next candidate.
    }
  }

  return null;
}

const EditorMagicButton = ({
  answerKey = "code",
  buttonColor = "secondary",
  EditorCode,
  onSuggestion,
  editorCodeChanger,
  editorType,
  defaultTarget: defaultTargetProp,
  disabled = false,
  newPrompt,
  newSystemPrompt,
  exampleResponse = "/* New and improved code here */",
}: EditorMagicButtonProps) => {
  const currentlevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentlevel - 1]);
  const name = level.name;
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [requestPrompt, setRequestPrompt] = useState("");
  const { config } = useAIProviderConfig();
  const { config: promptConfig } = useAIPromptConfig();
  const defaultTarget: EditorMagicSuggestionTarget =
    defaultTargetProp || (/\bsolution\b/i.test(editorType) ? "solution" : "template");
  const defaultSystemPromptAddOn = `Return a JSON object with keys "${answerKey}" and "target". "${answerKey}" must contain only the updated code as a string. "target" must be either "template" or "solution". If the user explicitly mentions template or solution, follow that. Otherwise use "${defaultTarget}".`;
  const prompt = useMemo(
    () =>
      newPrompt ||
      fillPromptTemplate(promptConfig.editorPromptTemplate, {
        levelName: name,
        editorType,
      }),
    [editorType, name, newPrompt, promptConfig.editorPromptTemplate],
  );
  const systemPrompt = useMemo(
    () =>
      newSystemPrompt ||
      fillPromptTemplate(promptConfig.editorSystemPromptTemplate, {
        levelName: name,
        editorType,
      }),
    [editorType, name, newSystemPrompt, promptConfig.editorSystemPromptTemplate],
  );

  const handleSuggestion = (nextCode: string) => {
    const target = inferSuggestionTarget(requestPrompt, defaultTarget);
    if (onSuggestion) {
      onSuggestion({ code: nextCode, target });
      return;
    }
    if (editorCodeChanger) {
      editorCodeChanger(nextCode);
    }
  };

  const fetchResponse = async () => {
    const trimmedRequestPrompt = requestPrompt.trim();
    const requestedTarget = inferSuggestionTarget(trimmedRequestPrompt, defaultTarget);
    try {
      setLoading(true);
      const response = await fetch(chatGPTURl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          apiEndpoint: config.apiEndpoint,
          apiKey: config.apiKey || undefined,
          systemPrompt:
            systemPrompt +
            "\n" +
            defaultSystemPromptAddOn +
            "\nExample response:\n```json\n" +
            `{"${answerKey}":"${exampleResponse.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}","target":"${requestedTarget}"}` +
            "\n```",
          prompt:
            prompt +
            (trimmedRequestPrompt
              ? `\nRequested changes from user:\n'''${trimmedRequestPrompt}'''\n`
              : "") +
            `\nCurrent target context: ${defaultTarget}\n` +
            "code to improve:" +
            "'''" +
            EditorCode +
            "'''",
        }),
      });
      const data = await response.json();
      const parsed = parseAiJsonResponse(data);
      if (!parsed) {
        throw new Error("AI response was not valid JSON.");
      }

      const nextCodeValue = parsed[answerKey];
      const nextTargetValue = parsed.target;
      const resolvedTarget =
        nextTargetValue === "template" || nextTargetValue === "solution"
          ? nextTargetValue
          : requestedTarget;

      if (typeof nextCodeValue === "string") {
        if (onSuggestion) {
          onSuggestion({ code: nextCodeValue, target: resolvedTarget });
        } else {
          handleSuggestion(nextCodeValue);
        }
      } else if (nextCodeValue !== undefined) {
        const stringifiedCode = JSON.stringify(nextCodeValue);
        if (onSuggestion) {
          onSuggestion({ code: stringifiedCode, target: resolvedTarget });
        } else {
          handleSuggestion(stringifiedCode);
        }
      } else {
        throw new Error(`AI response did not include "${answerKey}".`);
      }

      setOpen(false);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error("Error:", error);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled} data-color={buttonColor}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 space-y-3 border-border/80 bg-muted/90 p-3 text-foreground shadow-xl backdrop-blur"
      >
        <Textarea
          placeholder={`Example: Refactor this ${editorType} to be cleaner and add comments where helpful.`}
          rows={5}
          value={requestPrompt}
          onChange={(event) => setRequestPrompt(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={fetchResponse} disabled={loading}>
            {loading ? "Generating..." : "Submit"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EditorMagicButton;
