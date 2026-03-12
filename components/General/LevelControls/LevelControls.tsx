'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, Edit } from "lucide-react";
import { NavPopper } from "@/components/Navbar/Navbar";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LevelOpinion from "./LevelOpinion";
import { updateLevelName } from "@/store/slices/levels.slice";
import { renameLevelKey } from "@/store/slices/points.slice";
import { LevelData } from "@/components/InfoBoard/LevelData";
import { InfoText } from "@/components/InfoBoard/InfoText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiUrl } from "@/lib/apiUrl";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { ActiveUser } from "@/lib/collaboration/types";

interface LevelControlsProps {
  maxLevels: number;
  levelHandler: (level: number) => void;
  currentlevel: number;
  levelName?: string;
}

interface LevelSelectProps {
  levelHandler: (level: number) => void;
  compact?: boolean;
  compactLabel?: string;
}

const EMPTY_ACTIVE_USERS: ActiveUser[] = [];

const LevelControls = ({
  maxLevels,
  levelHandler,
  currentlevel,
  levelName,
}: LevelControlsProps) => {
  const [isNextLevelDialogOpen, setIsNextLevelDialogOpen] = React.useState(false);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const [editName, setEditName] = useState(false);
  const isCreator = options.creator;
  const dispatch = useAppDispatch();
  const [name, setName] = React.useState(levelName || "Unnamed");

  // take each of the level names for the select

  const decreaseLevel = () => {
    levelHandler(currentlevel - 1);
  };

  useEffect(() => {
    setName(levelName || "Unnamed");
  }, [levelName, currentlevel]);

  const increaseLevelConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isCreator) {
      increaseLevel();
      return;
    }
    // if the next level timer has not started, confirm
    const nextLevel = levels[currentlevel];
    if (nextLevel && !nextLevel.timeData.startTime) {
      setIsNextLevelDialogOpen(true);
      return;
    }
    increaseLevel();
  };
  const increaseLevel = () => {
    levelHandler(currentlevel + 1);
  };

  const resetAnchorEl = () => {
    setIsNextLevelDialogOpen(false);
  };

  const updateLevelNameHandler = (name: string) => {
    dispatch(updateLevelName({ levelId: currentlevel, text: name }));
  };

  const changeLevelName = (name: string) => {
    setName(name);
  };

  return (
    <>
      <NavPopper
        open={isNextLevelDialogOpen}
        paragraph="Are you sure you want to go to the next level? Timer for the next level will start immediately if you proceed."
        title="Next Level"
        handleConfirmation={increaseLevel}
        resetAnchorEl={resetAnchorEl}
      />
      <div className="flex justify-center items-center">
        <strong>
          {currentlevel}/{maxLevels}
        </strong>
        <Button
          size="icon"
          variant="ghost"
          disabled={currentlevel === 1}
          className={currentlevel === 1 ? "invisible" : "visible"}
          onClick={decreaseLevel}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col justify-center items-center m-0 p-0">
          <div className="text-base flex flex-col justify-center items-center">
            {/* {levelName && <>"The {levelName}"</>} */}
          </div>
          {(levels.length > 1 && <LevelSelect levelHandler={levelHandler} />) || (
            <InfoText>
              <LevelData
                dataType={"string"}
                reduxState="name"
                actionToDispatch={updateLevelName}
              />
            </InfoText>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          disabled={currentlevel === maxLevels}
          className={currentlevel === maxLevels ? "invisible" : "visible"}
          onClick={increaseLevelConfirm}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </>
  );
};

const getSyntaxIcons = (level: {
  lockHTML?: boolean;
  lockCSS?: boolean;
  lockJS?: boolean;
}) => {
  const icons = [];

  if (!level.lockHTML) {
    icons.push(
      <img
        key="html"
        src={apiUrl("/html.svg")}
        alt="HTML"
        title="HTML"
        className="h-4 w-4 inline"
      />
    );
  }

  if (!level.lockCSS) {
    icons.push(
      <img
        key="css"
        src={apiUrl("/css3.svg")}
        alt="CSS"
        title="CSS"
        className="h-4 w-4 inline"
      />
    );
  }

  if (!level.lockJS) {
    icons.push(
      <img
        key="js"
        src={apiUrl("/Javascript-shield.svg")}
        alt="JavaScript"
        title="JavaScript"
        className="h-4 w-4 inline"
      />
    );
  }

  return icons;
};

const getUserInitials = (user: ActiveUser) => {
  const source = user.userName || user.userEmail || "?";
  return source
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const LevelPresence = ({ users }: { users: ActiveUser[] }) => {
  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, 3);
  const remainingCount = users.length - visibleUsers.length;

  return (
    <div className="flex items-center -space-x-1">
      {visibleUsers.map((user) => (
        <Avatar
          key={user.clientId}
          className="h-5 w-5 border border-background"
          title={user.userName || user.userEmail}
          style={{ borderColor: user.color || undefined }}
        >
          {user.userImage && (
            <AvatarImage src={user.userImage} alt={user.userName || user.userEmail} />
          )}
          <AvatarFallback
            className="text-[10px] font-medium text-white"
            style={{ backgroundColor: user.color || undefined }}
          >
            {getUserInitials(user)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <Avatar className="h-5 w-5 border border-background">
          <AvatarFallback className="bg-muted text-[10px] font-medium">
            +{remainingCount}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export const LevelSelect = ({ levelHandler, compact = false, compactLabel }: LevelSelectProps) => {
  const levels = useAppSelector((state) => state.levels);
  const points = useAppSelector((state) => state.points);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const currentLevelData = levels[currentLevel - 1];
  const [showEdit, setShowEdit] = React.useState(false);
  const [openEditor, setOpenEditor] = React.useState(false);
  const [editingName, setEditingName] = React.useState("");
  const handleClickToEdit = () => {
    setEditingName(currentLevelData?.name || "");
    setOpenEditor(true);
  };

  const stateOptions = useAppSelector((state) => state.options);
  const isCreator = stateOptions.creator;
  const dispatch = useAppDispatch();
  const collaboration = useOptionalCollaboration();
  const activeUsers = collaboration?.activeUsers ?? EMPTY_ACTIVE_USERS;
  const myClientId = collaboration?.clientId ?? null;
  const getLevelAccuracy = (levelName: string) => {
    const accuracy = points.levels[levelName]?.accuracy;
    return typeof accuracy === "number" ? `${accuracy}%` : "0%";
  };
  const usersByLevel = React.useMemo(() => {
    const grouped = new Map<number, ActiveUser[]>();

    for (const user of activeUsers) {
      if (user.clientId === myClientId || !Number.isInteger(user.activeLevelIndex)) {
        continue;
      }

      const levelIndex = user.activeLevelIndex as number;
      const existing = grouped.get(levelIndex) ?? [];
      existing.push(user);
      grouped.set(levelIndex, existing);
    }

    return grouped;
  }, [activeUsers, myClientId]);

  const updateLevelNameHandler = (newName: string) => {
    const oldName = currentLevelData?.name || "";
    dispatch(updateLevelName({ levelId: currentLevel, text: newName }));
    if (oldName !== newName) {
      dispatch(renameLevelKey({ oldName, newName }));
    }
  };

  const handleNameChange = (name: string) => {
    setEditingName(name);
  };

  const levelSelectHandler = (selectedLevelName: string) => {
    const levelIndex = levels.findIndex(
      (level) => level.name === selectedLevelName
    );
    levelHandler(levelIndex + 1);
  };

  return (
    <div
      className={compact ? "w-full min-w-0 text-primary" : "min-w-[120px] text-primary"}
      onMouseEnter={() => setShowEdit(true)}
      onMouseLeave={() => setShowEdit(false)}
    >
      {openEditor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateLevelNameHandler(editingName);
            setOpenEditor(false);
          }}
          className="flex flex-row"
        >
          <Input
            autoFocus
            className="min-w-[200px] text-foreground border-primary bg-background"
            value={editingName}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => {
              updateLevelNameHandler(editingName);
              setOpenEditor(false);
            }}
          />
        </form>
      )}
      {!openEditor && (
        <div className={`flex items-center gap-2 ${compact ? "w-full justify-center" : "flex-row"}`}>
          <Select value={currentLevelData?.name || ""} onValueChange={levelSelectHandler}>
            <SelectTrigger
              className={
                compact
                  ? "mx-auto w-[min(18rem,100%)] min-w-0 max-w-full justify-center text-center text-primary border-0 shadow-none hover:bg-muted/70 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1 h-auto font-normal"
                  : "text-primary border-b-2 border-secondary hover:border-secondary focus:border-primary focus:outline-none px-2 py-1 h-auto font-normal min-w-[200px]"
              }
            >
              {compactLabel && (
                <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {compactLabel}
                </span>
              )}
              <SelectValue placeholder="Select level" className="truncate">
                {currentLevelData
                  ? compact
                    ? `${currentLevelData.name}${isCreator ? "" : ` - ${getLevelAccuracy(currentLevelData.name)}`}`
                    : `The ${currentLevelData.name}${isCreator ? "" : ` - ${getLevelAccuracy(currentLevelData.name)}`}`
                  : "Select level"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className={`bg-popover border border-border shadow-lg ${compact ? "min-w-[220px]" : "min-w-[300px]"}`}>
              {levels.map((level, index) => (
                <SelectItem
                  key={index}
                  value={level.name}
                  textValue={`${compact ? "" : "The "}${level.name}${isCreator ? "" : ` - ${getLevelAccuracy(level.name)}`}`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <SelectItemText>
                        {`${compact ? "" : "The "}${level.name}${isCreator ? "" : ` - ${getLevelAccuracy(level.name)}`}`}
                      </SelectItemText>
                      <LevelPresence users={usersByLevel.get(index) ?? []} />
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {getSyntaxIcons(level)}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isCreator && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClickToEdit}
              className={showEdit ? "visible" : "invisible"}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default LevelControls;
