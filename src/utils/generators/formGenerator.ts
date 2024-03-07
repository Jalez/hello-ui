/** @format */

const inputTypes = ["text", "email", "password", "number", "date"];
const labelPositions = ["above", "left", "right", "below"];
const buttonTypes = ["submit", "reset", "button"];
const formStyles = ["solid", "outlined", "rounded", "minimal"];

export const formGenerator = (primaryColor: string, secondaryColor: string) => {
  // Determine the current time and assign indexes based on time intervals
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  // Select content based on time index
  const selectedInputType = inputTypes[timeIndex % inputTypes.length];
  const selectedLabelPosition =
    labelPositions[timeIndex % labelPositions.length];
  const selectedButtonType = buttonTypes[timeIndex % buttonTypes.length];
  const selectedFormStyle = formStyles[timeIndex % formStyles.length];

  // Generate HTML for the selected input type
  const inputHTML = `
    <label for="${selectedInputType}" style="text-align: ${selectedLabelPosition};">${
    selectedInputType.charAt(0).toUpperCase() + selectedInputType.slice(1)
  }</label>
    <input type="${selectedInputType}" id="${selectedInputType}" name="${selectedInputType}" placeholder="Enter ${selectedInputType}">`;

  // Generate CSS for the selected input type
  const inputCSS = `
.custom-form input[type="${selectedInputType}"] {
  background-color: ${secondaryColor};
  border: 2px solid ${primaryColor};
  color: ${primaryColor};
  margin: 5px;
  padding: 10px;
  border-radius: ${selectedInputType === "email" ? "10px" : "5px"};
}`;

  const html = `<form class="custom-form ${selectedFormStyle}" style="flex-direction: ${
    selectedLabelPosition === "left" || selectedLabelPosition === "right"
      ? "row"
      : "column"
  };">
    <h1>Custom Form</h1>
    ${inputHTML}
    <button type="${selectedButtonType}">${
    selectedButtonType.charAt(0).toUpperCase() + selectedButtonType.slice(1)
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
  align-items: center;
  background-color: ${primaryColor};
  padding: 20px;
  height: 100%;
}

.custom-form label {
  margin-bottom: 5px;
}

${inputCSS}

.custom-form button {
  margin: 10px;
  padding: 10px;
  background-color: ${secondaryColor};
  border: none;
  border-radius: 10px;
  color: ${primaryColor};
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
