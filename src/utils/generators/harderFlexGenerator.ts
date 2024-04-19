/** @format */

import { generator } from "../../types";

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const harderFlexGenerator: generator = (
  primaryColor: string,
  secondaryColor: string,
  tertiaryColor?: string
) => {
  const bgColor = primaryColor;
  const textColor = secondaryColor;
  const colors = [
    "#496989",
    "#58A399",
    "#A8CD9F",
    "#E2F4C5",
    "#F4A896",
    primaryColor,
    secondaryColor,
  ];

  const instructions = `
  <div style="display:flex; flex-direction: row; gap: 1em;">
  <section>
    <h2>Requirements:</h2>
    <ul>
      <li>Utilize CSS Flexbox for the layout, specifically focusing on 'flex-direction', and flex property.</li>
      <li>You shouldnt need to use very many, if any, units of measurement for this exercise. Flexbox is designed to be flexible and responsive without needing to specify exact measurements.
      </li>
      <li>
       You may need to use media queries to make the layout responsive.
      </li>
    </ul>
  </section>
  
  <section>
    <h2>Exploration Suggestions:</h2>
    <p>To improve your CSS Flexbox skills, consider the following:</p>
    <ul>
      <li>Explore resources like MDN Web Docs or CSS-Tricks for detailed guides and examples on CSS Flexbox.</li>
      <li>Investigate the 'flex' property to understand how it can be used to control the size of flex items.</li>
      <li>Experiment with 'flex-direction' to change the direction of the flex container's main axis.</li>
      <li>
       For media queries, consider using the 'min-width' property to make the layout responsive.
      </li>

    </ul>
  </section>
  </div>
  `;
  const question_and_answer = {
    question: "What is the purpose of flex in css?",
    answer: `Flexbox is a layout model in CSS that allows you to design complex layouts more easily and efficiently. It provides a more efficient way to align and distribute space among items in a container, even when their size is unknown or dynamic. Flexbox is particularly useful for creating responsive designs and complex layouts that are difficult to achieve with traditional CSS methods.`,
  };

  const html = `<div class="container">
  <div class="box" style="background-color: #496989;">A</div>
  <div class="box" style="background-color: #58A399;">B</div>
  <div class="box" style="background-color: #A8CD9F;">C</div>
  <div class="box" style="background-color: #E2F4C5;">D</div>
  <div class="box" style="background-color: #F4A896;">E</div>
</div>

`;
  const TCSS = `
#root {
    margin: 0;
    background-color: ${bgColor};
    color: ${textColor};
    }
`;

  const css = `${TCSS}

.container {
  display: flex;
  flex-direction: column; 
  height: 80%; 
}

.box {
  flex: 1; 
}

@media (min-width: 400px) {
  .container {
    flex-direction: row;
    height: 100%; 
    width: 80%; 
  }
}
`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "Harder Flex",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: colors,
    scenarioDetails: [
      {
        width: 500,
        height: 200,
      },
      {
        width: 200,
        height: 500,
      },
    ],
  };
};
