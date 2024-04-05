/** @format */
import { useEffect, useRef } from "react";
import { styled } from "@mui/system";
import { updateUrl } from "../../store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";

import { scenario } from "../../types";

interface FrameProps {
  newHtml: string;
  newCss: string;
  id: string;
  name: string;
  frameUrl?: string;
  scenario: scenario;
}
const StyledIframe = styled("iframe")<{ width: number; height: number }>(
  ({ theme, width, height }) => ({
    width: `${width}px`,
    height: `${height}px`,
    // height: "0px",
    // make it invisible but still part of the dom
    // visibility: "hidden",
    overflow: "hidden",
    margin: "0px",
    padding: "0px",
    border: "none",
    // backgroundColor: theme.palette.secondary.main,
    position: "absolute",
    top: 0,
    zIndex: 10,
    left: 0,
    transition: "z-index 0.3s ease-in-out",
    "&:hover": {
      zIndex: -1,
    },
  })
);

export const Frame = ({
  id,
  newHtml,
  newCss,
  name,
  scenario,
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
            scenarioId: scenario.scenarioId,
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
      // console.log("currentLevel", currentLevel);
      if (!event.data.dataURL) return;
      dispatch(
        updateUrl({
          dataURL: event.data.dataURL,
          urlName: event.data.urlName,
          levelId: currentLevel,
          scenarioId: event.data.scenarioId,
          // imgData: event.data.imgData, //non-serializable data should not be sent, because it will not be saved in the state
        })
      );
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
          scenarioId: scenario.scenarioId,
        },
        "*"
      );
    }
  }, [newHtml, newCss, iframeRef]);
  // // console.log("scenario", scenario);
  if (!scenario) {
    return <div>Scenario not found</div>;
  }
  return (
    <StyledIframe
      id={id}
      ref={iframeRef}
      src={frameUrl}
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    />
  );
};
