const cardTitles = ["Card Title 1", "Card Title 2", "Card Title 3"];
const cardContents = [
  "This is card content 1.",
  "This is card content 2.",
  "This is card content 3.",
];
const cardStyles = ["solid", "outlined", "rounded", "minimal"];
const buttonTypes = ["More Info", "Buy Now", "Learn More"];

export const cardGenerator = (primaryColor: string, secondaryColor: string) => {
  // Randomly select title, content, style, and button text
  const selectedTitle =
    cardTitles[Math.floor(Math.random() * cardTitles.length)];
  const selectedContent =
    cardContents[Math.floor(Math.random() * cardContents.length)];
  const selectedStyle =
    cardStyles[Math.floor(Math.random() * cardStyles.length)];
  const selectedButtonText =
    buttonTypes[Math.floor(Math.random() * buttonTypes.length)];

  const html = `<div class="custom-card ${selectedStyle}" id="card-${selectedStyle}">
        <h2>${selectedTitle}</h2>
        <p>${selectedContent}</p>
        <button>${selectedButtonText}</button>
    </div>`;

  const css = `

.root {
  margin: 0px;
  padding: 0px;
  overflow: hidden;
}

.custom-card {
    text-align: center;
    margin: 10px;
    padding: 20px;
}

.custom-card h2 {
    margin: 0;
    padding-bottom: 10px;
}

.custom-card p {
    margin: 0;
    padding: 5px 0;
}

.custom-card button {
    padding: 10px 20px;
    border: none;
    text-transform: uppercase;
}



.custom-card.solid {
    background-color: ${primaryColor};
    color: ${secondaryColor};
}

.custom-card.outlined {
    background-color: transparent;
    color: ${primaryColor};
    border: 2px solid ${primaryColor};
}

.custom-card.rounded {
    background-color: ${primaryColor};
    color: ${secondaryColor};
    border-radius: 10px;
}

.custom-card.minimal {
    background-color: transparent;
    color: ${primaryColor};
}

#card-solid button {
    background-color: ${secondaryColor};
    color: ${primaryColor};
}

#card-outlined button {
    background-color: ${primaryColor};
    color: ${secondaryColor};
}

#card-rounded button {
    background-color: ${secondaryColor};
    color: ${primaryColor};
    border-radius: 5px;
}

#card-minimal button {
    background-color: ${primaryColor};
    color: ${secondaryColor};
    border: 2px solid ${primaryColor};
}
`;

  const THTML = `<div class="custom-card">Add your card content here</div>`;

  return {
    THTML,
    SHTML: html,
    TCSS: css,
    SCSS: css,
  };
};
