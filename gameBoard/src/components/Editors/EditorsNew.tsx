/** @format */

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import {
  updateCode,
  updateSolutionCode,
} from "../../store/slices/levels.slice";
import { useTheme } from "@mui/system";
import { Level } from "../../types";
import { Box } from "@mui/material";
import { javascript } from "@codemirror/lang-javascript";
import EditorTabs from "./EditorTabs";

const NewEditors = (): JSX.Element => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state: any) => state.levels);

  const level = levels[currentLevel - 1] as Level;
  const identifier = level?.identifier;

  const codeUpdater = (
    data: { html?: string; css?: string; js?: string },
    type: string
  ) => {
    if (!levels[currentLevel - 1]) return;
    if (type === "index") {
      dispatch(
        updateCode({
          id: currentLevel,
          code: { ...levels[currentLevel - 1].code, ...data },
        })
      );
    } else {
      dispatch(
        updateSolutionCode({
          id: currentLevel,
          code: { ...levels[currentLevel - 1].solution, ...data },
        })
      );
    }
  };

  function getCodeObject(language: "css" | "html" | "js", isCreator: boolean) {
    const levelCode = levels[currentLevel - 1].code[language];
    const levelSolution = levels[currentLevel - 1].solution[language];

    return isCreator
      ? { Solution: levelSolution, index: levelCode }
      : { index: levelCode };
  }

  const Css = getCodeObject("css", isCreator);
  const Html = getCodeObject("html", isCreator);
  const Js = getCodeObject("js", isCreator);

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
      }}
    >
      <EditorTabs
        title="HTML"
        codeUpdater={codeUpdater}
        identifier={identifier}
        lang={html()}
        fileNames={Object.keys(Html)}
        fileContent={Html as any}
        locked={level.lockHTML}
      />

      <EditorTabs
        title="CSS"
        codeUpdater={codeUpdater}
        identifier={identifier}
        lang={css()}
        fileNames={Object.keys(Css)}
        fileContent={Css as any}
        locked={level.lockCSS}
      />

      <EditorTabs
        title="JS"
        codeUpdater={codeUpdater}
        identifier={identifier}
        lang={javascript()}
        fileNames={Object.keys(Js)}
        fileContent={Js as any}
        locked={level.lockJS}
      />
    </Box>
  );
};

export default NewEditors;
