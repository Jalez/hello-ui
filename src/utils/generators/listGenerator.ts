/** @format */

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const listGenerator = (primaryColor: string, secondaryColor: string) => {
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  const selectedStyle = listStyles[timeIndex % listStyles.length];
  // Randomly select style and a subset of list items
  const selectedItems = listItems;

  const instructions = `Create a list that uses the ${selectedStyle} class, with the items in the picture. The list should have the correct class names and semantic tags to style the list and its content. For instance, the semantic tags "ul" and "li" should be present, each included with appropriate child elements. You can look at the stylesheet and provided picture for reference.`;
  const question_and_answer = {
    question: "What are lists in html?",
    answer: `Lists in HTML are used to present list of information in well formed and semantic way. There are three different types of lists in HTML and each one has a specific purpose and meaning. The three types of lists are: ordered list, unordered list, and definition list.`,
  };

  // Generate HTML for list items, with one item appearing as hovered
  const itemsHTML = selectedItems
    .map(
      (item, index) =>
        `<li class="${index === 0 ? "hovered" : ""}">${item}</li>`
    )
    .join("\n    ");

  const listTag = selectedStyle === "numbered" ? "ol" : "ul";

  const html = `<${listTag} class="custom-list ${selectedStyle}" id="list-${selectedStyle}">
    ${itemsHTML}
</${listTag}>`;

  const css = `

#root {    
  margin: 0px;
  padding: 0px;
  overflow: hidden;
  background-color: ${secondaryColor};
}

.custom-list {
    list-style-type: ${selectedStyle === "bullet" ? "disc" : "none"};
    padding-left: 20px;
    color: ${primaryColor};
}

.custom-list li {
    margin: 5px 0;
    padding: 5px;
}

.custom-list li.hovered, .custom-list.interactive li:hover {
    background-color: ${primaryColor};
    color: ${secondaryColor};
    cursor: pointer;
    border-radius: 5px;
}

.custom-list.numbered {
    list-style-type: decimal;
}

.custom-list.interactive li {
    background-color: ${secondaryColor};
    color: ${primaryColor};
    transition: background-color 0.3s;
}

.custom-list.minimal li {
    border-bottom: 1px solid ${secondaryColor};
    padding-bottom: 5px;
}
`;

  const THTML = `<ul class="custom-list">Add your list items here</ul>`;

  return {
    THTML,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    difficulty: "list",
    instructions,
    question_and_answer,
  };
};
