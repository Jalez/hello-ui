/** @format */

const inputTypes = ["text", "email", "password", "number", "date"];
const labelPositions = ["above", "left", "right", "below"];
const buttonTypes = ["submit", "reset", "button"];
const formStyles = ["solid", "outlined", "rounded", "minimal"];

export const formGenerator = (primaryColor: string, secondaryColor: string) => {
  // Randomly select one or two input types
  const selectedInputTypes = inputTypes
    .sort(() => 0.5 - Math.random())
    .slice(0, 1 + Math.floor(Math.random() * 2));

  // Generate HTML for each selected input type
  const inputsHTML = selectedInputTypes
    .map((type) => {
      return `<label for="${type}">${
        type.charAt(0).toUpperCase() + type.slice(1)
      }</label>
                <input type="${type}" id="${type}" name="${type}" placeholder="Enter ${type}">`;
    })
    .join("\n    ");

  // Generate unique CSS for each selected input type
  const inputsCSS = inputTypes
    .map((type) => {
      return `.custom-form input[type="${type}"] {
    background-color: ${secondaryColor};
    border: 2px solid ${primaryColor};
    color: ${primaryColor};
    margin: 5px;
    padding: 10px;
    border-radius: ${type === "email" ? "10px" : "5px"};
}`;
    })
    .join("\n\n");

  // Randomize button type
  const randomButtonType =
    buttonTypes[Math.floor(Math.random() * buttonTypes.length)];

  const html = `<form class="custom-form">
    <h1>Custom Form</h1>
    ${inputsHTML}
    <button type="${randomButtonType}">${
    randomButtonType.charAt(0).toUpperCase() + randomButtonType.slice(1)
  }</button>
</form>
`;

  const css = `
h1 {
    color: ${secondaryColor};
    text-align: center;
    text-transform: uppercase;
    text-decoration: underline;
}
.custom-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: ${primaryColor};
    padding: 20px;
    height: 100%;
}

.custom-form label {
    margin-bottom: 5px;
}

${inputsCSS}

.custom-form button[type="submit"]
    margin: 10px;
    padding: 10px;
    background-color: ${secondaryColor};
    border: none;
    border-radius: 10px;
    color: ${primaryColor};
}

.custom-form button[type="reset"]
    margin: 10px;
    padding: 10px;
    background-color: ${secondaryColor};
    border: 2px solid ${secondaryColor};
    border-radius: 0px;
    color: ${primaryColor};
}

.custom-form button[type="button"]
    margin: 10px;
    padding: 10px;
    background-color: ${primaryColor};
    border: none;
    border-radius: 10px;
    color: ${secondaryColor};
    text-decoration: underline;
}

footer {
    color: ${secondaryColor};
    text-align: center;
    text-transform: uppercase;
    font-style: italic;
}

`;

  const THTML = `<form class="custom-form">Add your form elements here</form>`;

  return {
    THTML,
    SHTML: html,
    TCSS: css,
    SCSS: css,
  };
};
