/** @format */

import { drawBoardWidth, drawBoardheight } from "../../constants";
import { generator } from "../../types";

const inputTypes = ["text", "email", "password", "number", "date"];
const labelTextDecorations = ["underline", "underline overline", "overline "];
const buttonTypes = ["submit"];
const formStyles = ["solid", "outlined", "rounded", "minimal"];

export const fullFormGenerator: generator = (
  primaryColor: string,
  secondaryColor: string
) => {
  // Determine the current time and assign indexes based on time intervals
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  // Select content based on time index
  const selectedInputType = inputTypes[timeIndex % inputTypes.length];

  const selectedLabelDecoration =
    labelTextDecorations[timeIndex % labelTextDecorations.length];
  const selectedButtonType = buttonTypes[timeIndex % buttonTypes.length];
  const selectedFormStyle = formStyles[timeIndex % formStyles.length];

  const instructions = `Create a <strong>form</strong> that uses the <em>${selectedFormStyle}</em> class, with a <em>${selectedInputType}</em> input, a <em>checkbox</em> inside a fieldset and a <em>${selectedButtonType}</em> button. The form should have a label for the input, and the label should have inline styling for ${selectedLabelDecoration}. For parent elements that need their children to be on the same row, you can use the <em>same-row-children</em> class. You must use the correct class names, ids and semantic tags to style the form and its content. For instance, the semantic tags "form", "label", "input" and "button" should be present. header, section and footer should be used. If Ids are required, Id is the same as the <em>type</em> of the element. You can look at the stylesheet and provided picture for reference.`;
  const question_and_answer = {
    question: "What are forms in html?",
    answer: `HTML forms are used to collect user input. They contain form elements like text fields, checkboxes, radio buttons, submit buttons, etc. Users enter data into these elements, and the data is sent to a server for processing.  `,
  };

  const colors = [
    "#496989",
    "#58A399",
    "#A8CD9F",
    "#E2F4C5",
    "#F4A896",
    primaryColor, //#fff
    secondaryColor, //#222
  ];

  // Generate HTML for the selected input type

  // Generate CSS for the selected input type

  const html = `<form>
  <h2>Contact Us</h2>
  <input type="text" placeholder="Name">
  <input type="email" placeholder="Email">
  <textarea placeholder="Your Message"></textarea>
  <button type="submit">Send</button>
</form>
`;

  const css = `
:root {
    --primary-color: ${colors[0]};
    --secondary-color: ${colors[1]};
    --text-color: #fff;
}

#root {
    font-family: Arial, sans-serif;
    padding: 20px;
    background-color: var(--secondary-color);
    color: var(--text-color);
}

form {
    background-color: var(--primary-color);
    padding: 10px;
    border-radius: 5px;
    max-width: 100%;
}

h2 {
    text-align: center;
}

input, textarea {
    width: calc(100% - 20px);
    margin-bottom: 10px;
    padding: 5px;
    border-radius: 3px;
    border: 1px solid var(--secondary-color);
}

button {
    width: 100%;
    padding: 5px;
    background-color: var(--secondary-color);
    color: var(--text-color);
    border: none;
    border-radius: 3px;
    cursor: pointer;
}

button:hover {
    background-color: darken(var(--secondary-color), 10%);
}
`;

  const TCSS = `
:root {
    --primary-color: ${colors[0]};
    --secondary-color: ${colors[1]};
    --text-color: #fff;
}

#root {
    font-family: Arial, sans-serif;
    padding: 20px;
    background-color: var(--secondary-color);
    color: var(--text-color);
} `;
  const THTML = `<form>Add your form elements here</form>`;

  return {
    THTML,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "Full form",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: false,
    lockJS: true,
    percentageTreshold: 95,
    percentageFullPointsTreshold: 99,
    colors: colors,
    dimensions: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
      },
    ],
  };
};
