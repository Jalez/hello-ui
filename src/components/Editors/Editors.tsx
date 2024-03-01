/** @format */

import CodeEditor from "./CodeEditor/CodeEditor";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { updateCode } from "../../store/slices/levels.slice";
import { Slider } from "../ArtBoards/Drawboard/ImageContainer/Slider/Slider";
import { Divider } from "@mui/material";

// interface EditorsProps {
// 	codeUpdater: (data: { html?: string; css?: string }) => void;
// 	htmlCode: string;
// 	cssCode: string;
// }

export const Editors = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state: any) => state.levels);
  const [showSlider, setShowSlider] = useState<boolean>(true);
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

  return (
    <div
      className="editors"
      style={{
        display: "flex",
        flexDirection: "row",
        alignContent: "center",
        justifyContent: "space-between",
        // maxWidth: '840px',
        flex: "1 1 100%",
        position: "relative",
        // width: '100%',
        backgroundColor: "#1E1E1E",
        // margin: '1em',
        maxWidth: "100%",
        flexWrap: "wrap",
        zIndex: 1,
        border: "3px solid #111",
      }}
    >
      <Slider
        sliderValue={50}
        dragSlider={() => {}}
        resetSlider={() => {}}
        hidden={showSlider}
      />
      <CodeEditor
        lang={css()}
        title="CSS"
        codeUpdater={codeUpdater}
        template={cssCode}
      />
      <Divider
        orientation="vertical"
        flexItem
        sx={{
          width: "10px",
          borderLeft: "2px solid #222",
          backgroundColor: "#222",
        }}
        // onMouseEnter={() => {
        //   console.log("mouse entered");
        //   setShowSlider(false);
        // }}
      />
      <CodeEditor
        lang={html()}
        title="HTML"
        codeUpdater={codeUpdater}
        template={htmlCode}
        locked={false}
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
  );
};
