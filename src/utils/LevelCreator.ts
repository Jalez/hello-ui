import { mainColor, secondaryColor } from "../constants";
import { cardGenerator } from "./generators/cardGenerator";
import { formGenerator } from "./generators/formGenerator";
import { listGenerator } from "./generators/listGenerator";
import { tableGenerator } from "./generators/tableGenerator";

const initialHtml: string = `<div></div>`;
const initialCss: string = `body {
	margin: 0px;
	background-color: ${secondaryColor};
}
div {
	width: 100px;
	height: 50px;
	background-color: ${mainColor};
}`;
const initialCode = {
  html: initialHtml,
  css: initialCss,
};

const initialDefaults = {
  week: "",
  completed: "no",
  accuracy: "0",
  code: initialCode,
  points: 0,
  maxPoints: 5,
  diff: "",
  drawingUrl: "",
  solutionUrl: "",
  drawnEvalUrl: "",
  solEvalUrl: "",
  solution: {
    html: "",
    css: "",
  },
  confettiSprinkled: false,
  instructions: "No instructions available",
  question_and_answer: {
    question: "No question available",
    answer: "No answer available",
  },
};

type week = "html_2_es" | "css_1_es" | "css_2_es";
export const createLevels = (week: week) => {
  const weekAndGenerators = {
    html_2_es: [cardGenerator, formGenerator],
    css_1_es: [listGenerator, tableGenerator],
    css_2_es: [cardGenerator, formGenerator], //TODO: Add more generators
  };
  const initialState = [];
  const generators = weekAndGenerators[week];
  if (!generators) return;

  let i = 0;
  // loop through the generators and create levels
  for (const generator of generators) {
    i++;
    let randomLevel = {
      image: "",
      colors: ["#fff"],
      pictures: [],
    };

    let generatedLevelDetails = generator(mainColor, secondaryColor);
    const level = {
      id: i,
      name: `Level ${i}`,

      buildingBlocks: {
        pictures: randomLevel.pictures,
        colors: [mainColor, secondaryColor],
      },
      ...initialDefaults,
      code: {
        html: generatedLevelDetails.THTML,
        css: generatedLevelDetails.TCSS,
      },
      week: week,
      image: "",
      difficulty: generatedLevelDetails.difficulty,
      instructions: generatedLevelDetails.instructions,
      question_and_answer: generatedLevelDetails.question_and_answer,
      help: {
        description: "NO help available",
        images: [],
        usefullCSSProperties: [],
      },
      solution: {
        html: generatedLevelDetails.SHTML,
        css: generatedLevelDetails.SCSS,
      },
      timeData: {
        startTime: 0,
        pointAndTime: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      },
    };
    initialState.push(level);
  }
  return initialState;
};
