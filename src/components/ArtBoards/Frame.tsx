/** @format */
import { useEffect, useRef } from "react";
import { styled } from "@mui/system";
import { updateUrl } from "../../store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import {
  drawBoardWidth,
  drawBoardheight, // Corrected the variable name
} from "../../constants";

interface FrameProps {
  newHtml: string;
  newCss: string;
  id: string;
  name: string;
  frameUrl?: string;
}

const StyledIframe = styled("iframe")(({ theme }) => ({
  width: `${drawBoardWidth}px`,
  height: `${drawBoardheight}px`, // Corrected the variable name
  overflow: "hidden",
  margin: "0",
  padding: "0",
  border: "none",
  backgroundColor: theme.palette.secondary.main, // Assuming secondaryColor corresponds to secondary color in the theme
}));

export const Frame = ({
  id,
  newHtml,
  newCss,
  name,
  frameUrl = "http://localhost:3500/" ||
    "https://tie-lukioplus.rd.tuni.fi/drawboard/",
}: FrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);

  useEffect(() => {
    const resendDataAfterMount = (event: MessageEvent) => {
      if (event.data === "mounted") {
        iframeRef.current?.contentWindow?.postMessage(
          {
            html: newHtml,
            css: newCss,
            name,
          },
          "*"
        );
      }
    };

    window.addEventListener("message", resendDataAfterMount);

    return () => {
      window.removeEventListener("message", resendDataAfterMount);
    };
  }, [newHtml, newCss, name]);

  useEffect(() => {
    const handleDataFromIframe = async (event: MessageEvent) => {
      if (!event.data.dataURL) return;
      dispatch(updateUrl({ ...event.data, id: currentLevel }));
    };

    window.addEventListener("message", handleDataFromIframe);

    return () => {
      window.removeEventListener("message", handleDataFromIframe);
    };
  }, [currentLevel]);

  useEffect(() => {
    // wait for the iframe to load
    const iframe = iframeRef.current;

    if (iframe) {
      // send a message to the iframe
      iframe.contentWindow?.postMessage(
        {
          html: newHtml,
          css: newCss,
          name,
        },
        "*"
      );
    }
  }, [newHtml, newCss, iframeRef, currentLevel]);

  return <StyledIframe id={id} ref={iframeRef} src={frameUrl} />;
};
