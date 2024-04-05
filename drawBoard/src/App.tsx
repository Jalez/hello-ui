/** @format */
import { ReactElement, useEffect, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";

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

function App() {
  const [html, setHtml] = useState<ReactElement>();
  const [css, setCss] = useState<string>();
  const [stylesCorrect, setStylesCorrect] = useState<Boolean>(false);
  const [urlName, setUrlName] = useState<string>();
  const [scenarioId, setScenarioId] = useState<string>();
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
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
      // TODO: handle javascript
    };

    window.addEventListener("message", handlePostMessage);
    // Once the component is mounted, send a message to the parent window
    window.parent.postMessage("mounted", "*");
    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  }, []);

  useEffect(() => {
    const style = document.querySelector("style") as HTMLStyleElement;
    style.innerHTML = css || "";
    setStylesCorrect(true);
  }, [stylesCorrect]);

  useEffect(() => {
    const board = document.getElementById("root");
    if (stylesCorrect && board) {
      domToPng(board).then((dataURL: string) => {
        // load the image, then get the pixel data
        window.parent.postMessage({ dataURL, urlName, scenarioId }, "*");
        // loadImage(dataURL).then((img: HTMLImageElement) => {
        //   const imgData = getPixelData(img, img.width, img.height);
        //   // // console.log("imgData in drawboard", imgData);
        //   window.parent.postMessage(
        //     { dataURL, urlName, scenarioId, imgData },
        //     "*"
        //   );
        // });
      });
    }
  }, [html, stylesCorrect]);

  return <>{html}</>;
}

export default App;
