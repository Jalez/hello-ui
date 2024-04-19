/** @format */

import { drawBoardWidth, drawBoardheight } from "../../constants";
import { generator } from "../../types";

export const DynamicListGenerator: generator = (
  primaryColor: string,
  secondaryColor: string,
  tertiaryColor?: string
) => {
  const instructions = `
  <section>
    <h2>Task Overview:</h2>
    <p>In this exercise, you're provided with the HTML structure and CSS styling for a dynamic list. Your task is to write the JavaScript necessary to dynamically populate the list based on data provided in the JavaScript template.</p>
  </section>  
<div style="display:flex; flex-direction: row; gap: 1em;">

  <section>
    <h2>JavaScript Objectives:</h2>
    <ul>
      <li>Understand how to select elements in the DOM using JavaScript.</li>
      <li>Learn to create new DOM elements and set their properties.</li>
      <li>Practice adding these elements to the DOM to build a dynamic list.</li>
    </ul>
  </section>

  <section>
    <h2>Key Concepts to Explore:</h2>
    <p>To complete your task, consider exploring the following JavaScript concepts:</p>
    <ul>
      <li>Document Object Model (DOM) manipulation methods such as <code>document.querySelector</code> and <code>document.createElement</code>.</li>
      <li>Array methods like <code>forEach</code> for iterating over data to create list items.</li>
    </ul>
  </section>

  <section>
    <h2>Challenge:</h2>
    <p>As an optional challenge, try the interactivity of your list by using the new "Slider/Interactive" toggle. This feature will be used in upcoming gage(s).</p>
  </section>
</div>
`;

  const question_and_answer = {
    question: "What are lists in html?",
    answer: `Lists in HTML are used to present list of information in well formed and semantic way. There are three different types of lists in HTML and each one has a specific purpose and meaning. The three types of lists are: ordered list, unordered list, and definition list.`,
  };

  const html = `<div id="dynamicContainer"></div>`;

  const css = `#root {    
    margin: 0px;
    padding: 0px;
    overflow: hidden;
    position: relative; 
    background-color: white; 
  }

#dynamicContainer {
  max-width: 300px;
  margin: 20px auto;
  padding: 20px;
  background: #222;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

ul {
  list-style: none;
  padding: 0;
}

li {
  padding: 10px;
  background: #ffffff;
  margin-bottom: 8px;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

li:nth-of-type(2n) {
background-color: grey; 
}

li:hover {
  background-color: #f9f9f9;
  transition: background-color 0.3s;
}

`;

  const SJS = `const listContainer = document.querySelector('#dynamicContainer');
  const ul = document.createElement('ul');
  
  const items = ['Item 1', 'Item 4', 'Item 3', 'Item 4', 'Item 5'];
  
  
  items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
  });
  
  listContainer.appendChild(ul);
  `;

  const TJS = `const listContainer = document.querySelector('#dynamicContainer');
const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    TJS: TJS,
    SJS: SJS,
    difficulty: "Dynamic list",
    instructions,
    question_and_answer,
    lockCSS: true,
    lockHTML: true,
    lockJS: false,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: [primaryColor, secondaryColor],
    scenarioDetails: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        js: "",
      },
    ],
  };
};
