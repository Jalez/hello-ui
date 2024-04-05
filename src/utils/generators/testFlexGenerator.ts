/** @format */

import { generator } from "../../types";

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const testFlexGenerator: generator = (
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
      <li>Utilize CSS Flexbox for the layout, specifically focusing on 'display', 'flex-direction', and 'justify-content'.</li>
      <li>Ensure all measurements for padding, margins, and font sizes are in 'pixels'.</li>
      <li>Experiment with different color combinations using the provided color palette.</li>
    </ul>
  </section>
  
  <section>
    <h2>Exploration Suggestions:</h2>
    <p>To improve your CSS Flexbox skills, consider the following:</p>
    <ul>
      <li>Explore resources like MDN Web Docs or CSS-Tricks for detailed guides and examples on CSS Flexbox.</li>
      <li>Investigate the 'flex-wrap' property to understand wrapping behavior in flex layouts.</li>
      <li>Experiment with 'flex-grow' and 'flex-shrink' to control item growth and shrinking in flex layouts.</li>
    </ul>
  </section>
  
  <section>
    <h2>Additional Guidelines:</h2>
    <ul>
      <li>Feel free to experiment with flex item placement, not just sticking to the example solution's selectors.</li>
      <li>Try styling individual flex items (e.g., header, main, aside) within the specified color and size constraints.</li>
    </ul>
  </section>
  </div>
  `;
  const question_and_answer = {
    question: "What is the purpose of flex in css?",
    answer: `Flexbox is a layout model in CSS that allows you to design complex layouts more easily and efficiently. It provides a more efficient way to align and distribute space among items in a container, even when their size is unknown or dynamic. Flexbox is particularly useful for creating responsive designs and complex layouts that are difficult to achieve with traditional CSS methods.`,
  };

  const html = `<div class="container">
  <div class="box" style="background-color: #496989;"></div>
  <div class="box" style="background-color: #58A399;"></div>
  <div class="box" style="background-color: #A8CD9F;"></div>
  <div class="box" style="background-color: #E2F4C5;"></div>
  <div class="box" style="background-color: #F4A896;"></div>
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
    height: 400px;
}

.box {
    flex: 1;
}

/* Media query for larger screens */
@media (min-width: 400px) {
    .container {
        flex-direction: row;
        width: 400px;
    }
}
`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "testFlex",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: colors,
    dimensions: [
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
