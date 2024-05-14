/** @format */

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import {
  updateCode,
  updateSolutionCode,
} from "../../store/slices/levels.slice";
import { Slider } from "./Slider/Slider";
import { useTheme } from "@mui/system";
import { Level } from "../../types";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { javascript } from "@codemirror/lang-javascript";
import EditorTabs from "./EditorTabs";

const NameOfStudentEditor = "index";
const editorMaxHeightLimit = 1000;
const editorMinHeightLimit = 100;
export const Editors = (): JSX.Element => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const [cssEditorWidth, setCssEditorWidth] = useState<number>(33.3);
  const [htmlEditorWidth, setHtmlEditorWidth] = useState<number>(33.3);
  const [jsEditorWidth, setJsEditorWidth] = useState<number>(33.3);
  const [editorHeight, setEditorHeight] = useState<number>(400);
  const [editorMaxHeight, setEditorMaxHeight] = useState<number>(editorHeight);
  const levels = useAppSelector((state: any) => state.levels);
  const solutions = useAppSelector((state: any) => state.solutions);

  const level = levels[currentLevel - 1] as Level;
  const solution = solutions[level?.identifier];
  const identifier = level?.identifier;
  const editorRef = useRef<HTMLDivElement>(null);

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

  const onSliderDragHtmlCSS = (e: any) => {
    // console.log("element width", e.target.clientWidth);

    const sliderXlocation = e.clientX;
    const totalWidth = window.innerWidth;

    const htmlWidth = (sliderXlocation / totalWidth) * 100;
    const differenceBetweenPreviousHtml = htmlWidth - htmlEditorWidth;

    const cssWidth = cssEditorWidth - differenceBetweenPreviousHtml;
    const widthInPixels = totalWidth / 100;
    const minWidth = 300;
    if (
      cssWidth * widthInPixels < minWidth ||
      htmlWidth * widthInPixels < minWidth
    )
      return;
    setHtmlEditorWidth(htmlWidth);
    setCssEditorWidth(cssWidth);
  };

  const onSliderDragCSSJS = (e: any) => {
    const sliderXlocation = e.clientX;
    const totalWidth = window.innerWidth;
    const newJsWidth = 100 - (sliderXlocation / totalWidth) * 100;
    const differenceBetweenPreviousJS = newJsWidth - jsEditorWidth;
    const newCssWidth = cssEditorWidth - differenceBetweenPreviousJS;
    const widthInPixels = totalWidth / 100;
    const minWidth = 300;
    if (
      newCssWidth * widthInPixels < minWidth ||
      newJsWidth * widthInPixels < minWidth
    )
      return;

    setCssEditorWidth(newCssWidth);
    setJsEditorWidth(newJsWidth);
  };

  const onEditorHeightUpperSliderDrag = (e: any) => {
    const sliderYlocation = e.clientY;
    const editorTopLocation = editorRef.current?.getBoundingClientRect().top;
    const locationDifference = sliderYlocation - (editorTopLocation as number);
    const newHeight = editorHeight - locationDifference;
    if (newHeight < editorMinHeightLimit) return;
    if (newHeight > editorMaxHeight) return;
    setEditorHeight(newHeight);
  };

  const onEditorHeightLowerSliderDrag = (e: any) => {
    const sliderYlocation = e.clientY;
    const editorBottomLocation =
      editorRef.current?.getBoundingClientRect().bottom;
    const locationDifference =
      sliderYlocation - (editorBottomLocation as number);
    const newMaxHeight = editorMaxHeight + locationDifference;
    if (newMaxHeight > editorMaxHeightLimit) return;
    if (newMaxHeight < editorMinHeightLimit) return;
    setEditorMaxHeight(newMaxHeight);
    const newHeight = editorHeight + locationDifference;
    if (newHeight < editorMinHeightLimit) return;
    if (newHeight > editorMaxHeight) return;
    setEditorHeight(newHeight);
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
    <>
      <Box
        sx={{
          height: editorMaxHeight,
          width: "100%",
          display: "flex",
        }}
      >
        <Box
          sx={{
            alignSelf: "flex-end",
            flex: "1 1 100%",
            height: editorHeight,
            width: "100%",
            margin: "0",
            zIndex: 100,
          }}
          ref={editorRef}
        >
          <Slider
            sliderValue={50}
            dragSlider={onEditorHeightUpperSliderDrag}
            resetSlider={() => {}}
            needsPress={true}
            orientation="horizontal"
          />
          <Box
            className=""
            sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "left",
              alignItems: "end",
              flex: "1 1 100%",
              position: "relative",
              backgroundColor: theme.palette.secondary.main,
              // blur out the background behind the editors
              height: "100%",

              width: "100%",
              flexWrap: "no-wrap",
              overflow: "hidden",
              alignSelf: "flex-end",
              zIndex: 1,
            }}
          >
            <EditorTabs
              title="HTML"
              EditorWidth={htmlEditorWidth}
              codeUpdater={codeUpdater}
              identifier={identifier}
              lang={html()}
              fileNames={Object.keys(Html)}
              fileContent={Html as any}
              locked={level.lockHTML}
            />

            <Slider
              sliderValue={33.3}
              dragSlider={onSliderDragHtmlCSS}
              resetSlider={() => {}}
              needsPress={true}
              orientation="vertical"
            />
            <EditorTabs
              title="CSS"
              EditorWidth={cssEditorWidth}
              codeUpdater={codeUpdater}
              identifier={identifier}
              lang={css()}
              fileNames={Object.keys(Css)}
              fileContent={Css as any}
              locked={level.lockCSS}
            />

            <Slider
              sliderValue={66.6}
              dragSlider={onSliderDragCSSJS}
              resetSlider={() => {}}
              needsPress={true}
              orientation="vertical"
            />
            <EditorTabs
              title="JS"
              EditorWidth={jsEditorWidth}
              codeUpdater={codeUpdater}
              identifier={identifier}
              lang={javascript()}
              fileNames={Object.keys(Js)}
              fileContent={Js as any}
              locked={level.lockJS}
            />

            {/* )} */}
          </Box>
          <Slider
            sliderValue={50}
            dragSlider={onEditorHeightLowerSliderDrag}
            resetSlider={() => {}}
            needsPress={true}
            orientation="horizontal"
          />
        </Box>
      </Box>
    </>
  );
};
