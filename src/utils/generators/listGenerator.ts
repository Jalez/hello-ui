/** @format */

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const listGenerator = (
  primaryColor: string,
  secondaryColor: string,
  tertiaryColor?: string
) => {
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

  const html = `<article>
  <header>
    <h1>
      Todays TODOS
    </h1>
  </header>
    <div class="list-container">
      <section>
            <h2> Store</h2>
            <ul class="custom-list bullet" id="list-bullet">
                <li class="done">Bananas</li>
                <li class="done">Tomatoes</li>
                <li class="next">Bread</li>
                <li class="todo">Butter</li>
            </ul>
      </section>
        <section
          class="right-section">
          <h2> Work</h2>
            <ol class="custom-list upper-roman" id="list-bullet">
                <li class="done">Daily meeting</li>
                <li class="done">Coffee break</li>
                <li class="done">"Team building"</li>
                <li class="next">Lunch</li>
            </ol>
      </section>
    </div>
</article>`;

  const css = `
  #root {    
      margin: 0px;
      padding: 0px;
      overflow: hidden;
      position: relative; 
      background-color: #FFF; 
    }

article {
  background-color: #222;
  color: #FFF;
  margin: 1em;
}

header h1 {
  margin: 0px; 
  font-size: 3em; 
  text-align: center; 
}


h2 {
  font-size: 2.5em;
  margin: 1em;
  margin-top: 0.5em; 
  margin-bottom: 0px;
}

.list-container {
  display: flex; 
}

ul, ol {
  margin: 0px;
  line-height: 1.5em; 
  font-size: 1.5em; 
}

.upper-roman {
  list-style-type: upper-roman; 
}

.done {
  text-decoration: line-through;
}

.next {
  font-weight: bold; 
  text-decoration: underline; 
}

`;

  const THTML = `<ul class="custom-list">Add your list items here</ul>`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: `#root {    
      margin: 0px;
      padding: 0px;
      overflow: hidden;
      position: relative; 
      background-color: #FFF; 
    }`,
    SCSS: css,
    difficulty: "list",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: false,
    lockJS: true,
  };
};
