/** @format */

import { drawBoardWidth, drawBoardheight } from "../../constants";
import { generator } from "../../types";

export const ActiveNavbarGenerator: generator = () => {
  const instructions = [
    {
      title: "Requirements:",
      content: [
        "Only use 'pixel' units for measurements like margins, padding, and font sizes.",
        "Limit your color choices to default colors or those included in the template.",
        "Focus on how to position the two lists (store and work) side by side.",
      ],
    },
    {
      title: "Exploration Suggestions:",
      content: [
        "For arranging the lists side by side, consider researching various CSS properties and techniques. Here are some keywords and resources to start your exploration:",
        "Search for 'CSS Flexbox' on websites like MDN Web Docs or CSS-Tricks for a comprehensive guide.",
        "Look up 'CSS Float Layout' for understanding the traditional float-based layouts.",
        "Investigate 'CSS display inline-block' for an alternative approach to layouts.",
      ],
    },
    {
      title: "Additional Guidelines:",
      content: [
        "You are not required to use the same selectors as in our model solution. Experiment with different ones to achieve the layout.",
        "Feel free to try out various styles for lists, headings, and other elements within the unit and color constraints.",
      ],
    },
  ];

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
    difficulty: "medium",
    name: "Medium Navbar",
    instructions,
    question_and_answer,
    lockCSS: true,
    lockHTML: true,
    lockJS: false,
    events: ["click"],
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: ["#333", "#fff"],
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
