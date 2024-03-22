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

  const html = `
  <table class="custom-table minimal" id="table-minimal">
        <caption>Current League Standings</caption>
  
      <thead>
          <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Games Played</th>
              <th>Points</th>
          </tr>
      </thead>
      <tbody>
          <tr>
              <td>1</td>
              <td>Aston Villa</td>
              <td>10</td> 
              <td class="points"> 30</td> 
          </tr>
          <tr>
              <td>2</td>
              <td>Manchester U</td>
              <td>10</td> 
              <td class="points">15</td> 
          </tr>
               <tr>
              <td>3</td>
              <td>Liverpool</td>
              <td>10</td> 
              <td class="points">10</td>
          </tr>
          <tr>
              <td>4</td>
              <td>Chelsea</td>
              <td>10</td> 
              <td class="total-points">5</td>
          </tr>
          <tr>
              <td>5</td>
              <td>Arsenal</td>
              <td>10</td> 
              <td class="total-points">1</td>
          </tr>
          <!-- Additional rows for other teams if necessary -->
      </tbody>
      <tfoot class="footer">
          <tr>
              <td colspan="3">Total Points</td>
              <td>61</td> <!-- Sum of Points -->
          </tr>
      </tfoot>
  </table>
  
  <footer>
    <p>As always, Aston Villa reigns <strong>supreme</strong>.</p>
  </footer>`;

  const css = `
  #root {    
    overflow: hidden;
    background-color: #fff;
  }
  
  .custom-table {
      width: 100%;
      border-collapse: collapse;
  }
  
  footer {
    text-align: center; 
  }
  
   th, td {
      padding: 0.2em;
     font-size: 1.5em; 
  }
  
  strong {
    text-decoration: underline; 
  }
  
  caption {
    font-size: 2em; 
  }
  
  td:nth-child(4) {
    background-color: black;
    color: white; 
  }
  
  td:nth-child(1n) {
    border-color: black; 
  }
  
  .custom-table.minimal th {
      border-bottom: 0.2em solid #222;
  }
  
  .footer tr td {
    border-bottom: none; 
  }
  
  td {
      border-bottom: 1px solid #222;
  }
  
`;

  const THTML = `<table class="custom-table">Add your table content here</table>`;
  const TCSS = `#root {    
    overflow: hidden;
    background-color: #fff;
  }
  
  .custom-table {
      width: 100%;
      border-collapse: collapse;
  }`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "table",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
  };
};
