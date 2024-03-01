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
  const selectedStyle =
    tableStyles[Math.floor(Math.random() * tableStyles.length)];

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
  };
};
