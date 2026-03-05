'use client';

import {
  setActiveArtTab,
} from "@/store/slices/options.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { RotateCcw, PanelLeft, Map } from "lucide-react";
import LevelControls from "@/components/General/LevelControls/LevelControls";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { resetLevel } from "@/store/slices/levels.slice";
import { useCallback, useEffect, useRef, useState } from "react";
import PoppingTitle from "@/components/General/PoppingTitle";
import CreatorControls from "@/components/CreatorControls/CreatorControls";
import MapEditor, { MapEditorRef } from "@/components/CreatorControls/MapEditor";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InfoGamePoints from "../InfoBoard/InfoGamePoints";
import { Switch } from "@/components/ui/switch";
import { ModeToggleButton } from "./ModeToggleButton";
import { AplusSubmitButton } from "./AplusSubmitButton";
import Link from "next/link";
import { useGameStore } from "@/components/default/games";

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const { openOverlay, isVisible } = useSidebarCollapse();
  const pathname = usePathname();
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const options = useAppSelector((state) => state.options);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
  const isCreator = options.creator;
  const isGameRoute = pathname.startsWith("/game/");
  const shouldShowMobileSidebarToggle = isVisible && isGameRoute;

  const level = levels[currentLevel - 1];
  const mapEditorRef = useRef<MapEditorRef>(null);
  const arrowRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const levelChanger = useCallback((pickedLevel: number) => {
    dispatch(setCurrentLevel(pickedLevel));
  }, []);

  const handleLevelReset = useCallback(() => {
    dispatch(resetLevel(currentLevel));
  }, [currentLevel]);

  const togglePopper = useCallback(() => {
    setAnchorEl(arrowRef.current ?? {});
  }, [arrowRef]);

  const handleAnchorElReset = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const activeArtTab = options.activeArtTab;
  const handleArtTabSwitch = useCallback(() => {
    dispatch(setActiveArtTab(activeArtTab === 0 ? 1 : 0));
  }, [activeArtTab, dispatch]);

  const renderGameMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8">
          Game
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 border-0 shadow-lg">
        <DropdownMenuLabel>Game Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => mapEditorRef.current?.triggerOpen()}>
          <Map className="h-4 w-4 mr-2" />
          Game Levels
        </DropdownMenuItem>
        {currentGame?.id && canEditCurrentGame && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/creator/${currentGame.id}/settings`}>Game Settings</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!level) return null;

  return (
    <div
      className="flex flex-row justify-around items-center w-full h-fit gap-2"
    >
      {/* Sidebar Toggle Button - Only visible on small screens */}
      {shouldShowMobileSidebarToggle && (
        <div className="lg:hidden">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={openOverlay}
            title="Open sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Compact nav: text-first menus (no icon-only mode). Hide Game and Level menus on game route. */}
      <div className="flex 2xl:hidden items-center gap-1">
        {isCreator && !isGameRoute && (
          <>
            <CreatorControls displayMode="menu" />
            {renderGameMenu()}
          </>
        )}

        <ModeToggleButton displayMode="icon-label" />

        {isGameRoute && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-2"
            title="Reset Level"
            onClick={togglePopper}
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </Button>
        )}

        <InfoGamePoints />
        <AplusSubmitButton displayMode="icon-label" />
      </div>

      {/* Left section - Creator controls or Art tab switch. Hide creator tools on game route. */}
      <div className="hidden 2xl:flex flex-row gap-2 justify-center items-center flex-[1_0_25%]">
        {isCreator && !isGameRoute ? (
          <CreatorControls displayMode="icon-label" />
        ) : (
          <PoppingTitle topTitle={activeArtTab === 0 ? "Model solution" : "Your design"}>
            <Switch checked={activeArtTab === 1} onCheckedChange={handleArtTabSwitch} />
          </PoppingTitle>
        )}
      </div>

      {/* Center section - Mode toggle, Reset, and Level controls */}
      <div className="flex flex-row gap-2 lg:gap-3 justify-center items-center flex-1 2xl:flex-[1_0_50%]">
        {/* Mode switch */}
        <div className="hidden 2xl:flex gap-1 items-center">
          <ModeToggleButton displayMode="icon-label" />
        </div>

        {/* Reset button */}
        {isGameRoute && (
          <div className="hidden 2xl:block">
            <Button
              size="sm"
              variant="ghost"
              className="gap-2"
              title="Reset Level"
              ref={arrowRef}
              onClick={togglePopper}
            >
              <RotateCcw className="h-5 w-5" />
              <span>Reset</span>
            </Button>
          </div>
        )}

        {/* Level controls - Always visible */}
        <LevelControls
          currentlevel={currentLevel}
          levelHandler={levelChanger}
          maxLevels={Object.keys(levels).length}
          levelName={level.name}
        />
      </div>

      {/* Right section - Game points + A+ submit */}
      <div className="hidden 2xl:flex flex-[1_0_25%] justify-center items-center gap-2">
        <InfoGamePoints />
        <AplusSubmitButton displayMode="icon-label" />
      </div>

      {/* Game Levels dialog controlled from navbar menu */}
      <MapEditor ref={mapEditorRef} renderButton={false} />

      {/* Dialog for reset confirmation */}
      <NavPopper
        anchorEl={anchorEl}
        paragraph="This is an irreversible action. All progress will be lost, but timer is not affected. Are you sure you want to reset the level?"
        title="Reset Level"
        handleConfirmation={handleLevelReset}
        resetAnchorEl={handleAnchorElReset}
      />
    </div>
  );
};

type NavPopperProps = {
  anchorEl: any;
  paragraph: string;
  title: string;
  handleConfirmation: () => void;
  resetAnchorEl?: () => void;
};

export const NavPopper = ({
  anchorEl,
  paragraph,
  title,
  handleConfirmation,
  resetAnchorEl,
}: NavPopperProps) => {
  const [openPopper, setOpenPopper] = useState(false);

  useEffect(() => {
    // whenever anchorEl changes, set openPopper to true
    if (anchorEl) {
      setOpenPopper(true);
    }
  }, [anchorEl]);

  useEffect(() => {
    // if openPopper is true, start a timer to close it after 10 seconds
    if (openPopper) {
      const timer = setTimeout(() => {
        setOpenPopper(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      resetAnchorEl && resetAnchorEl();
    }
  }, [openPopper, resetAnchorEl]);

  const confirmationAndClose = () => {
    handleConfirmation();
    setOpenPopper(false);
  };
  const handleClose = useCallback(() => setOpenPopper(false), []);

  return (
    <Dialog open={openPopper} onOpenChange={setOpenPopper}>
      <DialogContent className="z-[1200]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[0.7rem] w-[250px]">
            {paragraph}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button
            onClick={confirmationAndClose}
            variant="outline"
          >
            Yes
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
          >
            No
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
