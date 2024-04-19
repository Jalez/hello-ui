/** @format */

import CodeEditor from "./CodeEditor/CodeEditor";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { updateCode } from "../../store/slices/levels.slice";
import { Slider } from "./Slider/Slider";
import { useTheme } from "@mui/system";
import { Level } from "../../types";
import { Box } from "@mui/material";
import { javascript } from "@codemirror/lang-javascript";

const editorMaxHeightLimit = 1000;
const editorMinHeightLimit = 100;
export const Editors = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const [cssEditorWidth, setCssEditorWidth] = useState<number>(33.3);
  const [htmlEditorWidth, setHtmlEditorWidth] = useState<number>(33.3);
  const [jsEditorWidth, setJsEditorWidth] = useState<number>(33.3);
  const [editorHeight, setEditorHeight] = useState<number>(400);
  const [editorMaxHeight, setEditorMaxHeight] = useState<number>(editorHeight);
  const levels = useAppSelector((state: any) => state.levels);
  const [htmlCode, setHTMLCode] = useState<string>("");
  const [cssCode, setCSSCode] = useState<string>("");
  const [jsCode, setJSCode] = useState<string>("");
  const [lastHeight, setLastHeight] = useState<number>(
    document.body.scrollHeight
  );
  const [maxPercentage, setMaxPercentage] = useState<number>(0);
  const level = levels[currentLevel - 1] as Level;
  const identifier = level?.identifier;
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!levels[currentLevel - 1]) return;
    setHTMLCode(levels[currentLevel - 1].code.html);
    setCSSCode(levels[currentLevel - 1].code.css);
    setJSCode(levels[currentLevel - 1].code.js);
  }, [currentLevel, identifier]);

  const codeUpdater = (data: { html?: string; css?: string; js?: string }) => {
    if (!levels[currentLevel - 1]) return;
    dispatch(
      updateCode({
        id: currentLevel,
        code: { ...levels[currentLevel - 1].code, ...data },
      })
    );
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
    // get the current width of the event target
    // get the mouse location
    const sliderXlocation = e.clientX;
    const totalWidth = window.innerWidth;

    // Calculate remaining width for CSS and JS after HTML
    const newJsWidth = 100 - (sliderXlocation / totalWidth) * 100;
    const differenceBetweenPreviousJS = newJsWidth - jsEditorWidth;
    const newCssWidth = cssEditorWidth - differenceBetweenPreviousJS;
    // if new width is less than 200px for either editor, don't update the width
    //Because these are percentages, we first need to convert them to pixels
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

  return (
    <Box
      sx={{
        height: editorMaxHeight,
        width: "100%",
        display: "flex",
        justifyContent: "flex-end",
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
          <CodeEditor
            lang={html()}
            title="HTML"
            codeUpdater={codeUpdater}
            template={htmlCode}
            levelIdentifier={identifier}
            locked={level.lockHTML}
            width={htmlEditorWidth}
          />

          <Slider
            sliderValue={33.3}
            dragSlider={onSliderDragHtmlCSS}
            resetSlider={() => {}}
            needsPress={true}
            orientation="vertical"
          />
          <CodeEditor
            lang={css()}
            title="CSS"
            codeUpdater={codeUpdater}
            levelIdentifier={identifier}
            template={cssCode}
            width={cssEditorWidth}
            locked={level.lockCSS}
          />
          <Slider
            sliderValue={66.6}
            dragSlider={onSliderDragCSSJS}
            resetSlider={() => {}}
            needsPress={true}
            orientation="vertical"
          />
          {/* {level.lockJS ? null : ( */}
          <CodeEditor
            lang={javascript()}
            title="JS"
            codeUpdater={codeUpdater}
            levelIdentifier={identifier}
            template={jsCode}
            width={jsEditorWidth}
            locked={false}
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
  );
};
