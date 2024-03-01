/** @format */

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const listGenerator = (primaryColor: string, secondaryColor: string) => {
  // Randomly select style and a subset of list items
  const selectedStyle =
    listStyles[Math.floor(Math.random() * listStyles.length)];
  const selectedItems = listItems.sort(() => 0.5 - Math.random()).slice(0, 3);

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
  };
};
