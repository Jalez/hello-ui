/** @format */
import { useEffect, useRef } from "react";
import { styled } from "@mui/system";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";

import { scenario } from "../../types";
import { addSolutionUrl } from "../../store/slices/solutionUrls.slice";

interface FrameProps {
  newHtml: string;
  newCss: string;
  newJs: string;
  events: string[];
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
    backgroundColor: theme.palette.secondary.main,
    position: "absolute",
    top: 0,
    zIndex: 0,
    left: 0,
    // pointerEvents: "auto",
    transition: "z-index 0.3s ease-in-out",
  })
);

export const Frame = ({
  id,
  newHtml,
  newCss,
  newJs,
  name,
  events,
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
            js: newJs,
            events: JSON.stringify(events),
            scenarioId: scenario.scenarioId,
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
  }, [newHtml, newCss, name, newJs, scenario]);

  useEffect(() => {
    const handleDataFromIframe = async (event: MessageEvent) => {
      if (!event.data.dataURL) return;
      if (event.data.message !== "data") return;

      dispatch(
        addSolutionUrl({
          solutionUrl: event.data.dataURL,
          scenarioId: event.data.scenarioId,
        })
      );
    };

    window.addEventListener("message", handleDataFromIframe);

    return () => {
      window.removeEventListener("message", handleDataFromIframe);
    };
  }, [currentLevel]);

  useEffect(() => {
    const iframe = iframeRef.current;

    if (iframe) {
      iframeRef.current?.contentWindow?.postMessage(
        {
          message: "reload",
          name,
        },
        "*"
      );
    }
  }, [newHtml, newCss, iframeRef, newJs, name]);
  if (!scenario) {
    return <div>Scenario not found</div>;
  }
  return (
    <StyledIframe
      id={id}
      ref={iframeRef}
      src={frameUrl + `?name=${name}&scenarioId=${scenario.scenarioId}`}
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    />
  );
};
