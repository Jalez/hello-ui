/** @format */
import { ReactElement, useEffect, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { errorObj } from "./types";
import { ErrorFallback } from "./ErrorFallback";
import { getPixelData, sendToParent, setStyles } from "./utils";

const urlName = new URLSearchParams(window.location.search).get("name") || "";
const scenarioId =
  new URLSearchParams(window.location.search).get("scenarioId") || "";

function App() {
  const [html, setHtml] = useState<ReactElement>();
  const [css, setCss] = useState<string>();
  const [stylesCorrect, setStylesCorrect] = useState<Boolean>(false);
  const [jsCorrect, setJsCorrect] = useState<Boolean>(false);
  const [js, setJs] = useState<string>();
  const [error, setError] = useState<null | errorObj>();

  useEffect(() => {
    // //console.log("Drawboard URL sending mounted message");
    window.parent.postMessage("mounted", "*");
  }, []);

  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      if (urlName !== event.data.name) return;
      // //console.log(urlName, "Drawboard URL event.data", event);
      if (event.data?.message === "reload") {
        // //console.log(urlName, "Drawboard reloading");
        window.location.reload();
        return;
      }
      if (event.data.html) {
        // turn the string into a ReactNode element and set it as the state of the component
        setHtml(<kbd dangerouslySetInnerHTML={{ __html: event.data.html }} />);
      }
      if (event.data.css) {
        setCss(event.data.css);
        setStylesCorrect(false);
      }

      if (event.data.events) {
        // its a stringified array of strings (events), let's go throught them and add them to the window
        const events = JSON.parse(event.data.events);
        //console.log(urlName, "Drawboard URL setting event:", events);
        events.forEach((event: string) => {
          // //console.log("Drawboard URL setting event:", event);
          document.body.addEventListener(event, (e) => {
            //console.log(urlName, "Drawboard URL event listener:", event);
            const board = document.getElementById("root") as HTMLElement;
            //console.log("Drawboard URL sending message");
            domToPng(board).then((dataURL: string) => {
              const img = new Image();
              img.src = dataURL;
              img.onload = () => {
                const imgData = getPixelData(img);
                sendToParent(
                  imgData as unknown as string,
                  urlName,
                  scenarioId,
                  "pixels"
                );
                if (urlName === "solutionUrl") {
                  //console.log("Drawboard URL sending message for solutionUrl");
                  sendToParent(dataURL, urlName, scenarioId, "data");
                  return;
                }
              };
            });
          });
        });
      }

      if (event.data.js && event.data.js.trim()) {
        //console.log(urlName, "Drawboard URL setting js:", event.data.js);
        setJs(event.data.js);
        setJsCorrect(false);
      } else {
        setJsCorrect(true); // we want to do this because if there is no js, we don't want to keep trying to execute it
      }
    };

    window.addEventListener("message", handlePostMessage);
    // //console.log("Drawboard URL sending mounted message");
    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  });

  useEffect(() => {
    const handleGlobalError = (
      message: string | Event,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error
    ): boolean => {
      //console.log("Drawboard URL error handler");
      setError({
        message: message.toString(),
        lineno: lineno || 0,
        colno: colno || 0,
      });
      //console.error("Error in executing JS script:", {
      //   message,
      //   source,
      //   lineno,
      //   colno,
      //   error,
      // });
      return true; // Prevent the firing of the default event handler
    };
    window.onerror = handleGlobalError;

    if (js && !jsCorrect && stylesCorrect) {
      document.querySelectorAll("script").forEach((script) => {
        script.remove();
      });

      const blob = new Blob([`{ ${js} \n }`], { type: "text/javascript" });
      const scriptURL = URL.createObjectURL(blob);

      const script = document.createElement("script");
      script.src = scriptURL;
      script.onload = () => {
        //console.log("Drawboard URL script loaded");
        setJsCorrect(true);
        URL.revokeObjectURL(scriptURL); // Clean up blob URL after script is loaded
      };
      document.body.appendChild(script);
    }

    // Cleanup function to remove the global error handler when the component unmounts or dependencies change
    return () => {
      window.onerror = null;
    };
  }, [js, jsCorrect, stylesCorrect]);

  useEffect(() => {
    if (css) {
      try {
        setStyles(css);
        setStylesCorrect(true);
      } catch (error) {
        // //console.error("Drawboard URL error setting styles", error);
        setStylesCorrect(false);
      }
    }
  }, [css]);

  useEffect(() => {
    const board = document.getElementById("root");
    if (stylesCorrect && jsCorrect && board) {
      //console.log("Drawboard URL sending message for urlName", urlName);
      domToPng(board).then((dataURL: string) => {
        const img = new Image();
        img.src = dataURL;
        img.onload = () => {
          const imgData = getPixelData(img);
          sendToParent(
            imgData as unknown as string,
            urlName,
            scenarioId,
            "pixels"
          );
          if (urlName === "solutionUrl") {
            //console.log("Drawboard URL sending message for solutionUrl");
            sendToParent(dataURL, urlName, scenarioId, "data");
            return;
          }
        };
      });
    }
  }, [stylesCorrect, jsCorrect]);

  // //console.log("Drawboard rendering (error)", error);
  return <>{error ? <ErrorFallback error={error} /> : html}</>;
}

export default App;
