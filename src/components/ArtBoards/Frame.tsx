/** @format */
import { useEffect, useRef } from "react";
import { styled } from "@mui/system";
import { updateUrl } from "../../store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";

import { scenario } from "../../types";

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
      // //console.log("CSS-artist received new message");
      if (event.data === "mounted") {
        //console.log("CSS-artist sending the data");
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
      //console.log("CSS-artist received new message", event.data);
      if (event.data.message !== "data") return;
      //console.log(
      //   "CSS-artist updating the",
      //   event.data.urlName,
      //   " in the store"
      // );
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
    const iframe = iframeRef.current;

    if (iframe) {
      //console.log("CSS-artist telling drawboard to reload");
      iframeRef.current?.contentWindow?.postMessage(
        {
          message: "reload",
          name,
        },
        "*"
      );
    }
  }, [newHtml, newCss, iframeRef, newJs, name]);
  // // //console.log("scenario", scenario);
  if (!scenario) {
    return <div>Scenario not found</div>;
  }
  return (
    <StyledIframe
      id={id}
      ref={iframeRef}
      // add the name as a query parameter, also scenario id
      src={frameUrl + `?name=${name}&scenarioId=${scenario.scenarioId}`}
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    />
  );
};
