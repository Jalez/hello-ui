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

type EditorMagicButtonProps = {
  answerKey?: string;
  EditorCode: string;
  onSuggestion?: (newCode: string) => void;
  editorCodeChanger?: (newCode: string) => void;
  editorType: string;
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

const EditorMagicButton = ({
  answerKey = "code",
  buttonColor = "secondary",
  EditorCode,
  onSuggestion,
  editorCodeChanger,
  editorType,
  disabled = false,
  newPrompt,
  newSystemPrompt,
  exampleResponse = "{" + '"code": "/**New and improved code here*/"' + "}",
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
  const defaultSystemPromptAddOn = `Return a json with "${answerKey}"-key that contains the new and improved code for the component.`;
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
    if (onSuggestion) {
      onSuggestion(nextCode);
      return;
    }
    if (editorCodeChanger) {
      editorCodeChanger(nextCode);
    }
  };

  const fetchResponse = async () => {
    const trimmedRequestPrompt = requestPrompt.trim();
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
            defaultSystemPromptAddOn +
            "example response:" +
            "'''" +
            `{
              "${answerKey}": "${exampleResponse}"
            }` +
            "'''",
          prompt:
            prompt +
            (trimmedRequestPrompt
              ? `\nRequested changes from user:\n'''${trimmedRequestPrompt}'''\n`
              : "") +
            "code to improve:" +
            "'''" +
            EditorCode +
            "'''",
        }),
      });
      const data = await response.json();

      if (typeof data === "string") {
        const dP = JSON.parse(data);
        if (typeof dP[answerKey] === "string") {
          handleSuggestion(dP[answerKey] || "");
        } else {
          handleSuggestion(JSON.stringify(dP[answerKey] || ""));
        }
      } else if (typeof data === "object" && typeof data?.[answerKey] === "string") {
        handleSuggestion(data[answerKey]);
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
