'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addThisLevel } from "@/store/slices/levels.slice";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import PoppingTitle from "../General/PoppingTitle";
import { chatGPTURl } from "@/constants";
import { useImperativeHandle, forwardRef } from "react";
import { useAIProviderConfig } from "@/components/default/ai/providers/stores/aiProviderConfigStore";
import {
  fillPromptTemplate,
  useAIPromptConfig,
} from "@/components/default/ai/providers/stores/aiPromptConfigStore";

export interface MagicButtonRef {
  triggerGenerate: () => void;
}

interface MagicButtonProps {
  renderButton?: boolean;
}

const MagicButton = forwardRef<MagicButtonRef, MagicButtonProps>(({ renderButton = true }, ref) => {
  const dispatch = useAppDispatch();
  const currentlevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentlevel - 1]);
  const name = level.name;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleClose = () => setOpen(false);
  const [newLevel, setNewLevel] = useState<string>("");
  const { config } = useAIProviderConfig();
  const { config: promptConfig } = useAIPromptConfig();

  const fetchResponse = useCallback(async () => {
    const systemPrompt = promptConfig.levelSystemPrompt;
    const prompt = fillPromptTemplate(promptConfig.levelPromptTemplate, {
      levelName: name,
    });

    try {
      setOpen(false);
      setLoading(true);
      const response = await fetch(chatGPTURl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt,
          prompt,
          model: config.model,
          apiEndpoint: config.apiEndpoint,
          apiKey: config.apiKey || undefined,
        }),
      });
      const data = await response.json();
      if (typeof data === "string") {
        setNewLevel(data);
      } else {
        setNewLevel(JSON.stringify(data));
      }
      //open the modal
      setLoading(false);
      setOpen(true);
    } catch (error) {
      setLoading(false);
      console.error("Error:", error);
    }
  }, [config.apiEndpoint, config.apiKey, config.model, name, promptConfig.levelPromptTemplate, promptConfig.levelSystemPrompt]);

  const handleApprove = () => {
    dispatch(addThisLevel(newLevel));
    dispatch(initializePointsFromLevelsStateThunk());
  };

  const handleLevelEdit = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewLevel(event.target.value);
  };

  useImperativeHandle(ref, () => ({
    triggerGenerate: fetchResponse,
  }), [fetchResponse]);

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      {!loading && renderButton && (
        <PoppingTitle topTitle="Generate a level">
          <Button variant="ghost" size="icon" onClick={fetchResponse}>
            <Sparkles className="h-5 w-5" />
          </Button>
        </PoppingTitle>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle id="modal-modal-title">AI suggestion</DialogTitle>
          </DialogHeader>
          <textarea
            rows={10}
            className="w-full mt-2 p-2 border rounded bg-background text-foreground"
            value={newLevel}
            onChange={handleLevelEdit}
            aria-label="AI response textarea"
          />
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => {
                handleApprove();
                handleClose();
              }}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                console.log("Rejecting");
                handleClose();
              }}
            >
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

MagicButton.displayName = "MagicButton";

export default MagicButton;
