/** @format */

import CodeEditor from "./CodeEditor/CodeEditor";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useCallback, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { updateCode } from "../../store/slices/levels.slice";
import { Slider } from "./Slider/Slider";
import { useTheme } from "@mui/system";
import { Level } from "../../types";
import { Box } from "@mui/material";

export const Editors = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const [cssEditorWidth, setCssEditorWidth] = useState<string>("49.7%");
  const [htmlEditorWidth, setHtmlEditorWidth] = useState<string>("49.7%");
  const [editorHeight, setEditorHeight] = useState<string>("100%");
  const levels = useAppSelector((state: any) => state.levels);
  const [htmlCode, setHTMLCode] = useState<string>("");
  const [cssCode, setCSSCode] = useState<string>("");
  const [lastHeight, setLastHeight] = useState<number>(
    document.body.scrollHeight
  );
  const [maxPercentage, setMaxPercentage] = useState<number>(0);
  const level = levels[currentLevel - 1] as Level;
  const identifier = level?.identifier;

  useEffect(() => {
    if (!levels[currentLevel - 1]) return;
    setHTMLCode(levels[currentLevel - 1].code.html);
    setCSSCode(levels[currentLevel - 1].code.css);
  }, [currentLevel, identifier]);

  const codeUpdater = (data: { html?: string; css?: string }) => {
    if (!levels[currentLevel - 1]) return;
    dispatch(
      updateCode({
        id: currentLevel,
        code: { ...levels[currentLevel - 1].code, ...data },
      })
    );
  };

  const onSliderDrag = (e: any) => {
    // calculate the width of the html and css editors: CSS is on the left, HTML is on the right
    const sliderXlocation = e.clientX;
    const sliderWidth = window.innerWidth;
    const htmlWidth = (sliderXlocation / sliderWidth) * 100 - 0.5;
    const cssWidth = 100 - htmlWidth - 0.5;
    setCssEditorWidth(`${cssWidth}%`);
    setHtmlEditorWidth(`${htmlWidth}%`);
  };

  const onEditorHeightSliderDrag = (e: any) => {
    const sliderYlocation = e.clientY;
    const sliderHeight = window.innerHeight;
    const newMaxPercentage = 100 - (sliderYlocation / sliderHeight) * 100;
    const maxHeight = 1000;
    //if the slider is less than the max height OR it is decreasing in size
    if (sliderHeight < maxHeight || newMaxPercentage < maxPercentage) {
      setEditorHeight(`${newMaxPercentage}%`);
      const currentHeight = document.body.scrollHeight;

      if (lastHeight !== currentHeight && currentHeight == maxHeight) {
        setMaxPercentage(newMaxPercentage);
      }

      if (lastHeight !== currentHeight && currentHeight < maxHeight) {
        window.parent.postMessage(
          {
            action: "resizeIframe",
            frameHeight: currentHeight,
          },
          "*"
        ); // Replace '*' with the origin of the parent window for better security if known

        setLastHeight(currentHeight);
      }
    }
  };

  // // console.log("RENDERED");

  return (
    <Box
      sx={{
        alignSelf: "flex-end",
        flex: "1 1 100%",
        height: editorHeight,
        margin: "0",
      }}
    >
      <Slider
        sliderValue={50}
        dragSlider={onEditorHeightSliderDrag}
        resetSlider={() => {}}
        needsPress={true}
        orientation="horizontal"
      />
      <Box
        className=""
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "end",
          flex: "1 1 100%",
          position: "relative",
          backgroundColor: theme.palette.secondary.main,
          // blur out the background behind the editors
          height: "100%",
          maxWidth: "100%",
          flexWrap: "wrap",
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
          sliderValue={50}
          dragSlider={onSliderDrag}
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
      </Box>
    </Box>
  );
};
