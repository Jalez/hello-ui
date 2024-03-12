const tableHeaders = ["Header 1", "Header 2", "Header 3", "Header 4"];
const tableData = [
  ["Row 1, Cell 1", "Row 1, Cell 2", "Row 1, Cell 3", "Row 1, Cell 4"],
  ["Row 2, Cell 1", "Row 2, Cell 2", "Row 2, Cell 3", "Row 2, Cell 4"],
  ["Row 3, Cell 1", "Row 3, Cell 2", "Row 3, Cell 3", "Row 3, Cell 4"],
  ["Row 4, Cell 1", "Row 4, Cell 2", "Row 4, Cell 3", "Row 4, Cell 4"],
  ["Row 5, Cell 1", "Row 5, Cell 2", "Row 5, Cell 3", "Row 5, Cell 4"],
];
const tableStyles = ["bordered", "striped", "minimal"];

export const tableGenerator = (
  primaryColor: string,
  secondaryColor: string
) => {
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  // Select content based on time index

  const selectedStyle = tableStyles[timeIndex % tableStyles.length];

  const instructions = `Create a table that uses the ${selectedStyle} class, with the headers and data in the picture. The table should have the correct class names and semantic tags to style the table and its content. For instance, the semantic tags "table", "thead", "tbody", "tr", "th", and "td" should be present, each included with appropriate child elements. You can look at the stylesheet and provided picture for reference.`;
  const question_and_answer = {
    question: "What are tables in html?",
    answer: `HTML tables allow web developers to arrange data into rows and columns. They are used to display data in a tabular format and are created using the <table> tag. The <tr> tag is used to define the rows of the table, and the <td> tag is used to define the data cells. The <th> tag is used to define the header cells of the table. The <thead>, <tbody>, and <tfoot> tags are used to group the header, body, and footer of the table, respectively.`,
  };
  // Generate table headers
  const headersHTML = tableHeaders
    .map((header) => `<th>${header}</th>`)
    .join("");

  // Generate table rows and cells
  const rowsHTML = tableData
    .map((row, index) => {
      const rowCells = row.map((cell) => `<td>${cell}</td>`).join("");
      return `<tr>${rowCells}</tr>`;
    })
    .join("\n    ");

  const html = `<table class="custom-table ${selectedStyle}" id="table-${selectedStyle}">
        <thead>
            <tr>${headersHTML}</tr>
        </thead>
        <tbody>
            ${rowsHTML}
        </tbody>
    </table>`;

  const css = `
body {    
  margin: 0px;
  padding: 0px;
  overflow: hidden;
  background-color: ${secondaryColor};
}
.custom-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    color: ${primaryColor};
}

.custom-table th, .custom-table td {
    padding: 8px;
    border: ${
      selectedStyle === "bordered" ? "1px solid " + primaryColor : "none"
    };
}

.custom-table.striped tbody tr:nth-child(odd) {
    background-color: ${secondaryColor};
}

.custom-table.minimal th {
    border-bottom: 2px solid ${primaryColor};
}

.custom-table.minimal td {
    padding: 8px;
    border-bottom: 1px solid ${secondaryColor};
}
`;

  const THTML = `<table class="custom-table">Add your table content here</table>`;

  return {
    THTML,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    difficulty: "table",
    instructions,
    question_and_answer,
  };
};
