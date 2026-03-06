'use client';

import React from "react";
import { ChangeSet, Text } from "@codemirror/state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import CodeEditor from "./CodeEditor/CodeEditor";
import { Lock, LockOpen, Menu } from "lucide-react";
import { handleLocking, updateCode } from "@/store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { store } from "@/store/store";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { cn } from "@/lib/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/apiUrl";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { TabPresence } from "@/components/collaboration/TabPresence";
import { EditorType } from "@/lib/collaboration/types";

interface LanguageData {
  code: string;
  solution: string;
  locked: boolean;
}

interface EditorTabsProps {
  languages: {
    html: LanguageData;
    css: LanguageData;
    js: LanguageData;
  };
  codeUpdater: (language: 'html' | 'css' | 'js', code: string, isSolution: boolean) => void;
  identifier: string;
}

function EditorTabs({
  languages,
  codeUpdater,
  identifier,
}: EditorTabsProps) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const dispatch = useAppDispatch();

  const [activeLanguage, setActiveLanguage] = React.useState<'html' | 'css' | 'js'>('html');
  const [isTemplateMode, setIsTemplateMode] = React.useState<boolean>(true);

  const collaboration = useOptionalCollaboration();
  const isConnected = collaboration?.isConnected ?? false;
  const usersByTab = collaboration?.usersByTab ?? { html: [], css: [], js: [] };
  const myClientId = collaboration?.clientId ?? null;
  const otherUsersByTab = React.useMemo(() => {
    if (!myClientId) return { html: [] as typeof usersByTab.html, css: [] as typeof usersByTab.css, js: [] as typeof usersByTab.js };
    return {
      html: (usersByTab.html || []).filter((u) => u.clientId !== myClientId),
      css: (usersByTab.css || []).filter((u) => u.clientId !== myClientId),
      js: (usersByTab.js || []).filter((u) => u.clientId !== myClientId),
    };
  }, [usersByTab, myClientId]);
  const setActiveTab = collaboration?.setActiveTab;
  const lastRemoteCodeChange = collaboration?.lastRemoteCodeChange ?? null;
  const lastRemoteCodeResync = collaboration?.lastRemoteCodeResync ?? null;
  const lastAppliedRemotePatchTsRef = React.useRef<number | null>(null);
  const lastAppliedRemoteResyncTsRef = React.useRef<number | null>(null);
  const lastSentTabRef = React.useRef<EditorType | null>(null);

  const applyTemplateCodeUpdate = React.useCallback((
    levelIndex: number,
    editorType: 'html' | 'css' | 'js',
    nextContent: string
  ) => {
    const stateLevels = store.getState().levels;
    const targetLevel = stateLevels[levelIndex];
    if (!targetLevel) {
      return;
    }

    const currentCode = targetLevel.code || { html: "", css: "", js: "" };
    if ((currentCode[editorType] || "") === nextContent) {
      return;
    }

    dispatch(updateCode({
      id: levelIndex + 1,
      code: {
        ...currentCode,
        [editorType]: nextContent,
      },
    }));
  }, [dispatch]);

  React.useEffect(() => {
    if (!isConnected || !setActiveTab) return;
    if (lastSentTabRef.current === activeLanguage) return;
    lastSentTabRef.current = activeLanguage;
    setActiveTab(activeLanguage);
  }, [isConnected, setActiveTab, activeLanguage]);

  React.useEffect(() => {
    if (!lastRemoteCodeChange) return;
    if (lastAppliedRemotePatchTsRef.current === lastRemoteCodeChange.ts) return;

    lastAppliedRemotePatchTsRef.current = lastRemoteCodeChange.ts;

    const isActiveEditorTarget =
      lastRemoteCodeChange.levelIndex === currentLevel - 1 &&
      lastRemoteCodeChange.editorType === activeLanguage;
    if (isActiveEditorTarget) {
      return;
    }

    try {
      const currentLevels = store.getState().levels;
      const targetLevel = currentLevels[lastRemoteCodeChange.levelIndex];
      const currentContent = targetLevel?.code?.[lastRemoteCodeChange.editorType] || "";
      const nextContent = ChangeSet.fromJSON(lastRemoteCodeChange.changeSetJson)
        .apply(Text.of(currentContent.split("\n")))
        .toString();
      applyTemplateCodeUpdate(lastRemoteCodeChange.levelIndex, lastRemoteCodeChange.editorType, nextContent);
    } catch (error) {
      console.error("Failed to apply remote editor patch", error);
    }
  }, [activeLanguage, applyTemplateCodeUpdate, currentLevel, lastRemoteCodeChange]);

  React.useEffect(() => {
    if (!lastRemoteCodeResync) return;
    if (lastAppliedRemoteResyncTsRef.current === lastRemoteCodeResync.ts) return;

    lastAppliedRemoteResyncTsRef.current = lastRemoteCodeResync.ts;
    const isActiveEditorTarget =
      lastRemoteCodeResync.levelIndex === currentLevel - 1 &&
      lastRemoteCodeResync.editorType === activeLanguage;
    if (isActiveEditorTarget) {
      return;
    }
    applyTemplateCodeUpdate(lastRemoteCodeResync.levelIndex, lastRemoteCodeResync.editorType, lastRemoteCodeResync.content);
  }, [activeLanguage, applyTemplateCodeUpdate, currentLevel, lastRemoteCodeResync]);

  const handleLanguageChange = (newLanguage: string) => {
    const editorType = newLanguage as EditorType;
    setActiveLanguage(editorType);
    if (isConnected && setActiveTab) {
      lastSentTabRef.current = editorType;
      setActiveTab(editorType);
    }
  };

  const handleLockUnlock = async (language: 'html' | 'css' | 'js') => {
    console.log('handleLockUnlock called with language:', language);
    console.log('Current level:', currentLevel);
    // The reducer expects 'js', not 'javascript'
    const lockType = language;
    console.log('Dispatching handleLocking with type:', lockType);
    dispatch(
      handleLocking({
        levelId: currentLevel,
        type: lockType,
      })
    );

    if (!identifier || !UUID_REGEX.test(identifier)) {
      return;
    }

    const level = levels[currentLevel - 1];
    if (!level) return;

    const nextLocks = {
      lockHTML: language === "html" ? !level.lockHTML : level.lockHTML,
      lockCSS: language === "css" ? !level.lockCSS : level.lockCSS,
      lockJS: language === "js" ? !level.lockJS : level.lockJS,
    };

    try {
      const response = await fetch(apiUrl(`/api/levels/${identifier}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextLocks),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to persist editor locks:", errorText);
      }
    } catch (error) {
      console.error("Failed to persist editor locks:", error);
    }
  };

  const getLanguageLang = (lang: 'html' | 'css' | 'js') => {
    switch (lang) {
      case 'html':
        return html();
      case 'css':
        return css();
      case 'js':
        return javascript();
      default:
        return html();
    }
  };

  const getLanguageTitle = (lang: 'html' | 'css' | 'js'): "HTML" | "CSS" | "JS" => {
    switch (lang) {
      case 'html':
        return 'HTML';
      case 'css':
        return 'CSS';
      case 'js':
        return 'JS';
    }
  };

  const handleCodeUpdate = (data: { html?: string; css?: string; js?: string }, type: string) => {
    const isSolution = type === 'Solution' || type === 'solution';
    console.log('handleCodeUpdate called with data:', data, 'type:', type, 'isSolution:', isSolution);
    const updatedLanguage = (Object.keys(data).find(
      (key) => key === 'html' || key === 'css' || key === 'js'
    ) || activeLanguage) as 'html' | 'css' | 'js';

    const code = data[updatedLanguage];
    if (code !== undefined) {
      codeUpdater(updatedLanguage, code, isSolution);
    }
  };

  const languageTabs = [
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'js', label: 'JavaScript' },
  ];

  return (
    <div
      className="flex flex-col justify-start items-stretch m-0 p-0 flex-1 min-h-[300px] h-full w-full relative border border-border/50"
    >
      <div className="flex flex-col justify-start items-stretch m-0 p-0 flex-1 h-full w-full relative ">
        <Tabs value={activeLanguage} onValueChange={handleLanguageChange} className="w-full h-full flex flex-col">
          <div className="flex items-center gap-0 bg-border/20 dark:bg-muted/60">
            {/* Mobile Menu Button - Only visible on small screens */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Editor</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {languageTabs.map((tab) => {
                    const tabLanguage = tab.value as 'html' | 'css' | 'js';
                    const tabLocked = languages[tabLanguage].locked;
                    const isActive = activeLanguage === tabLanguage;
                    const tabUsers = otherUsersByTab[tabLanguage] || [];

                    return (
                      <DropdownMenuItem
                        key={tab.value}
                        onClick={() => handleLanguageChange(tab.value)}
                        className={cn(
                          "cursor-pointer flex items-center justify-between",
                          isActive && "bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{tab.label}</span>
                          {isConnected && tabUsers.length > 0 && (
                            <TabPresence users={tabUsers} size="sm" />
                          )}
                        </div>
                        {isCreator && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleLockUnlock(tabLanguage);
                            }}
                            title={tabLocked ? "Unlock" : "Lock"}
                          >
                            {tabLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                          </Button>
                        )}
                      </DropdownMenuItem>
                    );
                  })}

                  {isCreator && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-sm text-muted-foreground">Template</span>
                        <Switch
                          checked={!isTemplateMode}
                          onCheckedChange={(checked) => setIsTemplateMode(!checked)}
                          aria-label="Toggle between template and solution"
                        />
                        <span className="text-sm text-muted-foreground">Solution</span>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Tabs - Hidden on mobile */}
            <TabsList className="hidden md:flex flex-1 gap-0">
              {languageTabs.map((tab) => {
                const tabLanguage = tab.value as 'html' | 'css' | 'js';
                const tabLocked = languages[tabLanguage].locked;
                const isActive = activeLanguage === tabLanguage;
                const tabUsers = otherUsersByTab[tabLanguage] || [];

                return (
                  <div
                    key={tab.value}
                    className={cn(
                      "flex items-center h-full",
                      isActive ? "bg-secondary" : "bg-border/20 dark:bg-muted/60"
                    )}
                  >
                    <TabsTrigger
                      value={tab.value}
                      className="text-primary flex items-center gap-1.5 border-0 h-full"
                    >
                      <span>{tab.label}</span>
                      {isConnected && tabUsers.length > 0 && (
                        <TabPresence users={tabUsers} size="sm" />
                      )}
                    </TabsTrigger>
                    {isCreator && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-full w-6 p-0 px-2 flex items-center justify-center relative z-10 rounded-none"
                        onClick={(e) => {
                          console.log('Lock button clicked for tab:', tab.value, 'language:', tabLanguage);
                          console.log('Event target:', e.target);
                          console.log('Event currentTarget:', e.currentTarget);
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('Calling handleLockUnlock with:', tabLanguage);
                          handleLockUnlock(tabLanguage);
                        }}
                        onMouseDown={(e) => {
                          console.log('Lock button mouseDown for tab:', tab.value, 'language:', tabLanguage);
                          e.stopPropagation();
                        }}
                        title={tabLocked ? "Unlock" : "Lock"}
                      >
                        {tabLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                );
              })}
            </TabsList>

            {/* Active Tab Display on Mobile - Shows current tab with user avatars */}
            <div className="md:hidden flex-1 flex items-center justify-center gap-2 px-2">
              <span className="text-sm font-medium text-primary">
                {languageTabs.find(tab => tab.value === activeLanguage)?.label}
              </span>
              {isConnected && (otherUsersByTab[activeLanguage] || []).length > 0 && (
                <TabPresence users={otherUsersByTab[activeLanguage]} size="sm" />
              )}
            </div>

            {/* Template/Solution Toggle - Hidden on mobile (shown in menu) */}
            {isCreator && (
              <div className="hidden md:flex items-center gap-2 px-2">
                <span className="text-sm text-muted-foreground">Template</span>
                <Switch
                  checked={!isTemplateMode}
                  onCheckedChange={(checked) => setIsTemplateMode(!checked)}
                  aria-label="Toggle between template and solution"
                />
                <span className="text-sm text-muted-foreground">Solution</span>
              </div>
            )}
          </div>
          {languageTabs.map((tab) => {
            const langData = languages[tab.value as 'html' | 'css' | 'js'];
            const code = isTemplateMode ? langData.code : langData.solution;
            const locked = langData.locked;

            return (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="flex-1 flex flex-col min-h-0 mt-0"
              >
                <CodeEditor
                  lang={getLanguageLang(tab.value as 'html' | 'css' | 'js')}
                  title={getLanguageTitle(tab.value as 'html' | 'css' | 'js')}
                  codeUpdater={handleCodeUpdate}
                  template={code}
                  levelIdentifier={identifier}
                  locked={locked}
                  type={isTemplateMode ? 'Template' : 'Solution'}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}

export default EditorTabs;
