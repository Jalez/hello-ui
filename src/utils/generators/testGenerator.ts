/** @format */

import { drawBoardWidth, drawBoardheight } from "../../constants";
import { generator } from "../../types";



export const testGenerator: generator = (
  primaryColor,
  secondaryColor,
  tertiaryColor
) => {
  const instructions = `
  <div style="display:flex; flex-direction: row; gap: 0.2em;">
  <section>
  <h2>Level tester:</h2>
  <ul>
  <li>This level is only for testing css/html.</li>
  </ul>
  </section>  
  </div>

  `;
  const question_and_answer = {
    question: "What are lists in html?",
    answer: `Lists in HTML are used to present list of information in well formed and semantic way. There are three different types of lists in HTML and each one has a specific purpose and meaning. The three types of lists are: ordered list, unordered list, and definition list.`,
  };

  // Generate HTML for list items, with one item appearing as hovered

  const html = `
`;

  const css = `
  #root {    
    margin: 0px;
    padding: 0px;
    overflow: hidden;
    position: relative; 
    background-color: ${primaryColor}; 
  }
`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: `#root {    
      margin: 0px;
      padding: 0px;
      overflow: hidden;
      position: relative; 
      background-color: ${secondaryColor}; 
    }`,
    SCSS: css,
    difficulty: "test",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: false,
    lockJS: false,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: [primaryColor, secondaryColor],
    dimensions: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
      },
      {
        width: drawBoardheight,
        height: drawBoardWidth,
      },
    ],
  };
};
