import React from "react";
import { Tabs, Tab, Box, IconButton } from "@mui/material";
import CodeEditor from "./CodeEditor/CodeEditor";

import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { handleLocking } from "../../store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
function EditorTabs({
  EditorWidth,
  fileNames,
  fileContent,
  codeUpdater,
  identifier,
  locked,
  lang,
  title,
}: {
  title: "HTML" | "CSS" | "JS";
  EditorWidth: number;
  lang: any;
  fileNames: string[];
  fileContent: {
    [key: string]: string;
  };
  codeUpdater: (
    data: { html?: string; css?: string; js?: string },
    type: string
  ) => void;
  identifier: string;
  locked: boolean;
}) {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const dispatch = useAppDispatch();
  const [value, setValue] = React.useState(fileNames[0]);

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  const handleLockUnlock = () => {
    dispatch(
      handleLocking({
        levelId: currentLevel,
        type: title.toLowerCase(),
      })
    );
    // setLocked((prev) => !prev);
  };

  const createCodeEditorForFile = (code: string) => {
    return (
      <CodeEditor
        lang={lang}
        title={title}
        codeUpdater={codeUpdater}
        template={code}
        levelIdentifier={identifier}
        locked={locked}
        type={value}
      />
    );
  };
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        m: 0,
        p: 0,
        flex: 1,
        height: "100%",
        position: "relative",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          m: 0,
          p: 0,
          flex: 1,
          height: "100%",
          position: "relative",
        }}
      >
        <Tabs value={value} onChange={handleChange}>
          {fileNames.map((name, index) => (
            <Tab
              sx={{
                color: "primary.main",
              }}
              key={index}
              value={name}
              label={name}
            />
          ))}
        </Tabs>
        {isCreator && (
          <IconButton
            color="primary"
            onClick={handleLockUnlock}
            // title={locked ? "Unlock" : "Lock"}
          >
            {locked ? <LockIcon /> : <LockOpenIcon />}
          </IconButton>
        )}
      </Box>
      {createCodeEditorForFile(fileContent[value])}
    </Box>
  );
}

export default EditorTabs;
