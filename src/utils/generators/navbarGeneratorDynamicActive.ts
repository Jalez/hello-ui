/** @format */

import { drawBoardWidth, drawBoardheight } from "../../constants";
import { generator } from "../../types";

export const ActiveNavbarGenerator: generator = (
  primaryColor: string,
  secondaryColor: string,
  tertiaryColor?: string
) => {
  const instructions = `
  <div style="display:flex; flex-direction: row; gap: 0.2em;">
  <section>
  <h2>Requirements:</h2>
  <ul>
  <li>Only use 'pixel' units for measurements like margins, padding, and font sizes.</li>
  <li>Limit your color choices to default colors or those included in the template.</li>
  <li>Focus on how to position the two lists (store and work) side by side.</li>
  </ul>
  </section>  

  <section>
  <h2>Exploration Suggestions:</h2>
  <p>For arranging the lists side by side, consider researching various CSS properties and techniques. Here are some keywords and resources to start your exploration:</p>
  <ul>
  <li>Search for "CSS Flexbox" on websites like MDN Web Docs or CSS-Tricks for a comprehensive guide.</li>
  <li>Look up "CSS Float Layout" for understanding the traditional float-based layouts.</li>
  <li>Investigate "CSS display inline-block" for an alternative approach to layouts.</li>
  </ul>
  </section>

  <section>
  <h2>Additional Guidelines:</h2>
  <ul>
  <li>You are not required to use the same selectors as in our model solution. Experiment with different ones to achieve the layout.</li>
  <li>Feel free to try out various styles for lists, headings, and other elements within the unit and color constraints.</li>
  </ul>
  </section>
  `;
  const question_and_answer = {
    question: "What are lists in html?",
    answer: `Lists in HTML are used to present list of information in well formed and semantic way. There are three different types of lists in HTML and each one has a specific purpose and meaning. The three types of lists are: ordered list, unordered list, and definition list.`,
  };

  const html = `<nav id="navbar">
  <ul>
      <li><a href="#" id="home">Home</a></li>
      <li><a href="#" id="about">About</a></li>
      <li><a href="#" id="services">Services</a></li>
      <li><a href="#" id="contact">Contact</a></li>
  </ul>
</nav>
<div id="dialog" style="display:none;"></div>`;

  const css = `#root {    
    margin: 0px;
    padding: 0px;
    overflow: hidden;
    position: relative; 
    background-color: #fff; 
  }

body {
  font-family: Arial, sans-serif;
}

nav#navbar ul {
  list-style: none;
  background-color: #333;
  text-align: center;
  padding: 0;
  margin: 0;
}


nav#navbar ul li {
  display: inline;
}

nav#navbar ul li a {
  text-decoration: none;
  color: white;
  background-color: #333;
  padding: 10px 20px;
  display: inline-block;
}

#dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid #333;
  padding: 20px;
  background-color: white;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  z-index: 1000;
}
`;

  const SJS = `const dialog = document.getElementById('dialog');

function openDialog(text) {
    dialog.textContent = text;
    dialog.style.display = 'block';
}

function setupLink(id, message) {
    const link = document.getElementById(id);
    link.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent default anchor behavior
        openDialog(message);
    });
}

// Setup links
setupLink('home', 'Welcome to the Home Page!');
setupLink('about', 'Learn more About Us.');
setupLink('services', 'Our Services are listed here.');
setupLink('contact', 'Contact Us here.');

  `;

  return {
    THTML: html,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    TJS: "",
    SJS: SJS,
    difficulty: "Active Navbar",
    instructions,
    question_and_answer,
    lockCSS: true,
    lockHTML: true,
    lockJS: false,
    events: ["click"],
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: [primaryColor, secondaryColor],
    scenarioDetails: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        js: "document.getElementById('about').click();",
      },
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        js: "document.getElementById('services').click();",
      },
      // {
      //   width: drawBoardheight,
      //   height: drawBoardWidth,
      // },
    ],
  };
};
