/** @format */
import { ReactElement, useEffect, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import xss from "xss";

const sheet = new CSSStyleSheet();

const getPixelData = (img = new Image(), width: number, height: number) => {
  const canvas = document.createElement("canvas");
  // Set the width and height of the canvas to the width and height of the image
  canvas.width = img.width;
  canvas.height = img.height;
  // Get the 2D context of the canvas
  const ctx = canvas.getContext("2d");
  // Draw the image on the canvas
  ctx?.drawImage(img, 0, 0);
  // Get the image data from the canvas
  const imgData = ctx?.getImageData(0, 0, width, height);
  // Resolve the promise with the image data
  return imgData;
};

function loadImage(base64Url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64Url;
  });
}

type errorObj = {
  message: string;
  lineno?: number;
  colno?: number;
};

function App() {
  const [html, setHtml] = useState<ReactElement>();
  const [css, setCss] = useState<string>();
  const [stylesCorrect, setStylesCorrect] = useState<Boolean>(false);
  const [jsCorrect, setJsCorrect] = useState<Boolean>(false);
  const [urlName, setUrlName] = useState<string>();
  const [scenarioId, setScenarioId] = useState<string>();
  const [js, setJs] = useState<string>();
  const [error, setError] = useState<null | errorObj>();

  useEffect(() => {
    window.parent.postMessage("mounted", "*");
  }, []);

  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      // console.log("Drawboard URL received message and setting error to null");
      // get the name from query parameter "name"
      const name = new URLSearchParams(window.location.search).get("name");
      if (name !== event.data.name) return;
      // console.log("Drawboard URL event.data", event);
      // setError(null);
      if (event.data?.message === "reload") {
        // console.log("Drawboard reloading");
        window.location.reload();
        return;
      }
      if (event.data.name) {
        setUrlName(event.data.name);
        // console.log("name", event.data.name);
      }
      if (event.data.html) {
        // turn the string into a ReactNode element and set it as the state of the component
        setHtml(<kbd dangerouslySetInnerHTML={{ __html: event.data.html }} />);
      }
      if (event.data.css) {
        setCss(event.data.css);
        setStylesCorrect(false);
      }
      if (event.data.scenarioId) {
        setScenarioId(event.data.scenarioId);
      }

      if (event.data.events) {
        // its a stringified array of strings (events), let's go throught them and add them to the window
        const events = JSON.parse(event.data.events);
        console.log("Drawboard URL setting event:", events);
        events.forEach((event: string) => {
          // console.log("Drawboard URL setting event:", event);
          document.body.addEventListener(event, (e) => {
            const urlName = new URLSearchParams(window.location.search).get(
              "name"
            );
            const scenarioId = new URLSearchParams(window.location.search).get(
              "scenarioId"
            );

            console.log("Drawboard URL event listener:", event);
            // console.log("Drawboard URL event:", e);
            const board = document.getElementById("root") as HTMLElement;
            // if (stylesCorrect && jsCorrect && board) {
            console.log("Drawboard URL sending message");
            console.log(urlName, scenarioId);
            domToPng(board).then((dataURL: string) => {
              window.parent.postMessage({ dataURL, urlName, scenarioId }, "*");
            });
          });
        });
      }

      // remove empty spaces from js
      if (event.data.js.trim()) {
        // console.log("Drawboard URL setting js:", event.data.js);
        setJs(event.data.js);
        setJsCorrect(false);
        // execute the javascript code
      } else {
        setJsCorrect(true); // we want to do this because if there is no js, we don't want to keep trying to execute it
      }
    };

    window.addEventListener("message", handlePostMessage);
    // Once the component is mounted, send a message to the parent window
    // console.log("Drawboard URL sending mounted message");
    // listen for any kind of events
    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  });

  useEffect(() => {
    // Setting up the global error handler
    const handleGlobalError = (
      message: string | Event,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error
    ): boolean => {
      console.log("Drawboard URL error handler");
      setError({
        message: message.toString(),
        lineno: lineno || 0,
        colno: colno || 0,
      });
      console.error("Error in executing JS script:", {
        message,
        source,
        lineno,
        colno,
        error,
      });
      return true; // Prevent the firing of the default event handler
    };
    window.onerror = handleGlobalError;

    if (js && !jsCorrect && stylesCorrect) {
      // console.log("Drawboard URL executing js");
      // if (!js.includes("dynamicContainer")) {
      //   setError({
      //     message:
      //       "Please use the element with id 'dynamicContainer' to insert your elements.",
      //   });
      //   return;
      // }

      // const dynamicContainer = document.getElementById("dynamicContainer");
      // if (dynamicContainer !== null) {
      //   dynamicContainer.innerHTML = "";
      // }

      // Remove all existing script elements before adding a new one
      document.querySelectorAll("script").forEach((script) => {
        script.remove();
      });

      const blob = new Blob([`{  ${js} }`], { type: "text/javascript" });
      const scriptURL = URL.createObjectURL(blob);

      const script = document.createElement("script");
      script.src = scriptURL;
      script.onload = () => {
        console.log("Drawboard URL script loaded");
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
    const style = document.querySelector("style") as HTMLStyleElement;
    style.innerHTML = css || "";
    setStylesCorrect(true);
  }, [stylesCorrect]);

  useEffect(() => {
    const board = document.getElementById("root");
    if (stylesCorrect && jsCorrect && board) {
      console.log("Drawboard URL sending message");
      domToPng(board).then((dataURL: string) => {
        window.parent.postMessage({ dataURL, urlName, scenarioId }, "*");
      });
    }
  }, [stylesCorrect, jsCorrect, urlName, scenarioId]);

  // console.log("Drawboard rendering (error)", error);
  return <>{error ? <ErrorFallback error={error} /> : html}</>;
}

export default App;

type FallbackProps = {
  error: errorObj;
};

const ErrorFallback = ({ error }: FallbackProps) => {
  return (
    <div
      role="alert"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        backgroundColor: "rgba(255, 0, 0, 0.5)",
        color: "white",
      }}
    >
      <h2
        style={{
          color: "white",
          fontSize: "1.5rem",
          fontWeight: "bold",
          marginBottom: "1rem",
        }}
      >
        Oops! Something went wrong :(
      </h2>
      <pre
        style={{
          color: "white",
          fontSize: "1rem",
          whiteSpace: "pre-wrap",
          textAlign: "center",
          // bold text
          fontWeight: "bold",
        }}
      >
        {error.message}
      </pre>
      <pre>
        {error.lineno && error.colno && (
          <span>
            Line number: {error.lineno}, column number: {error.colno}
          </span>
        )}
      </pre>
    </div>
  );
};
