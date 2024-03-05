/** @format */

import CodeEditor from "./CodeEditor/CodeEditor";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { updateCode } from "../../store/slices/levels.slice";
import { Slider } from "./Slider/Slider";

export const Editors = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const [cssEditorWidth, setCssEditorWidth] = useState<string>("49.5%");
  const [htmlEditorWidth, setHtmlEditorWidth] = useState<string>("49.5%");
  const [editorHeight, setEditorHeight] = useState<string>("50%");
  const levels = useAppSelector((state: any) => state.levels);
  const [htmlCode, setHTMLCode] = useState<string>(
    levels[currentLevel - 1].code.html
  );
  const [cssCode, setCSSCode] = useState<string>(
    levels[currentLevel - 1].code.css
  );

  useEffect(() => {
    setHTMLCode(levels[currentLevel - 1].code.html);
    setCSSCode(levels[currentLevel - 1].code.css);
  }, [currentLevel]);
  const codeUpdater = (data: { html?: string; css?: string }) => {
    dispatch(
      updateCode({
        id: currentLevel,
        code: { ...levels[currentLevel - 1].code, ...data },
      })
    );
    if (data.html) {
      setHTMLCode(data.html);
    }
    if (data.css) {
      setCSSCode(data.css);
    }
  };

  const onSliderDrag = (e: any) => {
    console.log("slider dragged");
    // calculate the width of the html and css editors: CSS is on the left, HTML is on the right
    const sliderXlocation = e.clientX;
    const sliderWidth = window.innerWidth;
    const cssWidth = (sliderXlocation / sliderWidth) * 100 - 0.5;
    const htmlWidth = 100 - cssWidth - 0.5;
    console.log("cssWidth", cssWidth, "htmlWidth", htmlWidth);
    setCssEditorWidth(`${cssWidth}%`);
    setHtmlEditorWidth(`${htmlWidth}%`);
  };

  const onEditorHeightSliderDrag = (e: any) => {
    console.log("slider dragged");
    // calculate the width of the html and css editors: CSS is on the left, HTML is on the right
    const sliderYlocation = e.clientY;
    const sliderHeight = window.innerHeight;
    const height = 100 - (sliderYlocation / sliderHeight) * 100;
    setEditorHeight(`${height}%`);
  };

  return (
    <div
      style={{ alignSelf: "flex-end", flex: "1 1 100%", height: editorHeight }}
    >
      <Slider
        sliderValue={50}
        dragSlider={onEditorHeightSliderDrag}
        resetSlider={() => {}}
        needsPress={true}
        orientation="horizontal"
      />
      <div
        className=""
        style={{
          display: "flex",
          flexDirection: "row",
          // alignContent: "center",
          justifyContent: "space-between",
          alignItems: "end",
          // maxWidth: '840px',
          flex: "1 1 100%",
          position: "relative",
          // width: '100%',
          // backgroundColor: "#1e1e1e",
          // margin: '1em',
          height: "100%",
          maxWidth: "100%",
          flexWrap: "wrap",
          overflow: "hidden",
          alignSelf: "flex-end",

          zIndex: 1,
          // border: "3px solid #111",
        }}
      >
        <CodeEditor
          lang={css()}
          title="CSS"
          codeUpdater={codeUpdater}
          template={cssCode}
          width={cssEditorWidth}
          locked={true}
        />

        <Slider
          sliderValue={50}
          dragSlider={onSliderDrag}
          resetSlider={() => {}}
          needsPress={true}
          orientation="vertical"
        />
        <CodeEditor
          lang={html()}
          title="HTML"
          codeUpdater={codeUpdater}
          template={htmlCode}
          locked={false}
          width={htmlEditorWidth}
        />

        {/* <ButtonGroup
				variant='contained'
				aria-label='Code editor button group'
				// color='primary'
				sx={{
					display: 'flex',
					flexDirection: 'row',
					alignContent: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					borderRadius: '0',
					bgcolor: '#35393C',
				}}>
				<Button sx={{ flex: '1 1 auto' }} onClick={buttonClickHandler}>
					Execute
          </Button>
        </ButtonGroup> */}
      </div>
    </div>
  );
};
