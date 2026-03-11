'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Save, Plus, Sparkles, Map, SlidersHorizontal, Loader2 } from "lucide-react";
import { useRef } from "react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { Switch } from "@/components/ui/switch";
import { useLevelRemover } from "./hooks/useLevelRemover";
import { useLevelSaver } from "./hooks/useLevelSaver";
import { useNewLevel } from "./hooks/useNewLevel";
import MagicButton, { MagicButtonRef } from "./UniversalMagicButton";
import MapEditor, { MapEditorRef } from "./MapEditor";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

type CreatorControlsDisplayMode = "icon-label" | "icon" | "menu";

interface CreatorControlsProps {
  displayMode?: CreatorControlsDisplayMode;
}

const CreatorControls = ({ displayMode = "icon-label" }: CreatorControlsProps) => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const { handleRemove } = useLevelRemover();
  const { handleSave, autoSaveEnabled, toggleAutoSave } = useLevelSaver();
  const { handleNewLevelCreation, isCreating } = useNewLevel();
  const magicButtonRef = useRef<MagicButtonRef>(null);
  const mapEditorRef = useRef<MapEditorRef>(null);
  const router = useRouter();

  if (!isCreator) return null;

  const inlineIconLabel = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="gap-2" onClick={handleSave}>
        <Save className="h-4 w-4" />
        Save
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={handleNewLevelCreation} disabled={isCreating}>
        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {isCreating ? "Creating..." : "Create"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => magicButtonRef.current?.triggerGenerate()}
        data-testid="creator-generate-level"
      >
        <Sparkles className="h-4 w-4" />
        Generate
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.push(apiUrl("/account/generation"))}>
        <SlidersHorizontal className="h-4 w-4" />
        Generation Settings
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => mapEditorRef.current?.triggerOpen()}>
        <Map className="h-4 w-4" />
        Game Levels
      </Button>
      <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleRemove}>
        <Trash2 className="h-4 w-4" />
        Remove
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={toggleAutoSave}>
        <Save className="h-4 w-4" />
        {autoSaveEnabled ? "Auto-save On" : "Auto-save Off"}
      </Button>
    </div>
  );

  const inlineIcons = (
    <div className="flex items-center gap-1">
      <PoppingTitle topTitle="Save Level">
        <Button variant="ghost" size="icon" onClick={handleSave}>
          <Save className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Create Level">
        <Button variant="ghost" size="icon" onClick={handleNewLevelCreation} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Generate Level">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => magicButtonRef.current?.triggerGenerate()}
          data-testid="creator-generate-level"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Generation Settings">
        <Button variant="ghost" size="icon" onClick={() => router.push(apiUrl("/account/generation"))}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Game Levels">
        <Button variant="ghost" size="icon" onClick={() => mapEditorRef.current?.triggerOpen()}>
          <Map className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Remove Level">
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle={autoSaveEnabled ? "Disable auto-save" : "Enable auto-save"}>
        <Button variant="ghost" size="icon" onClick={toggleAutoSave}>
          <Save className="h-4 w-4" />
        </Button>
      </PoppingTitle>
    </div>
  );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="Level tools">
          Level
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="border-0 shadow-lg">
        <DropdownMenuLabel>Level Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Level
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNewLevelCreation} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          {isCreating ? "Creating..." : "Create Level"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleRemove}>
          <Trash2 className="h-4 w-4 mr-2" />
          Remove Level
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            toggleAutoSave();
          }}
        >
          <Save className="h-4 w-4 mr-2" />
          <span className="flex-1">{autoSaveEnabled ? "Disable Auto-save" : "Enable Auto-save"}</span>
          <Switch checked={autoSaveEnabled} className="pointer-events-none scale-75" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => magicButtonRef.current?.triggerGenerate()} data-testid="creator-generate-level">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Level
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(apiUrl("/account/generation"))}>
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Generation Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {displayMode === "icon-label" && inlineIconLabel}
      {displayMode === "icon" && inlineIcons}
      {displayMode === "menu" && menu}
      {/* Render dialog components without buttons */}
      <MagicButton ref={magicButtonRef} renderButton={false} />
      <MapEditor ref={mapEditorRef} renderButton={false} />
    </>
  );
};

export default CreatorControls;
