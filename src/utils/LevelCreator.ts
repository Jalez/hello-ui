import { mainColor, secondaryColor } from "../constants";
import { generator, levelNames } from "../types";
import { cardGenerator } from "./generators/cardGenerator";
import { easyFlexGenerator } from "./generators/easyFlexGenerator";
import { easyGridGenerator } from "./generators/easyGridGenerator";
import { formGenerator } from "./generators/formGenerator";
import { listGenerator } from "./generators/listGenerator";
import { tableGenerator } from "./generators/tableGenerator";
import { testGenerator } from "./generators/testGenerator";

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

type generatorNameAndFunction = {
  [K in levelNames]: generator;
};

export const generatorNameAndFunction: generatorNameAndFunction = {
  test: testGenerator,
  card: cardGenerator,
  form: formGenerator,
  list: listGenerator,
  table: tableGenerator,
  flex: easyFlexGenerator,
  grid: easyGridGenerator,
};
type week = "html_2_es" | "css_1_es" | "css_2_es" | "css_2" | "all";
export const createLevels = (week: week) => {
  const weekAndGenerators = {
    html_2_es: [cardGenerator, formGenerator],
    css_1_es: [listGenerator, tableGenerator],
    css_2: [easyFlexGenerator, easyGridGenerator],
    css_2_es: [cardGenerator, formGenerator], //TODO: Add more generators,
    all: [
      testGenerator,
      cardGenerator,
      formGenerator,
      listGenerator,
      tableGenerator,
      easyFlexGenerator,
      easyGridGenerator,
    ],
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
      pictures: [],
    };
    // add grey as tertiary color
    const tertiaryColor = "#888";

    let generatedLevelDetails = generator(
      mainColor,
      secondaryColor,
      tertiaryColor
    );
    const level = {
      identifier: Math.random().toString(36).substring(7),
      name: generatedLevelDetails.difficulty,

      buildingBlocks: {
        pictures: randomLevel.pictures,
        colors: generatedLevelDetails.colors,
      },
      ...initialDefaults,
      code: {
        html: generatedLevelDetails.THTML,
        css: generatedLevelDetails.TCSS,
      },
      week: week,
      image: "",
      percentageTreshold: generatedLevelDetails.percentageTreshold,
      percentageFullPointsTreshold:
        generatedLevelDetails.percentageFullPointsTreshold,
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
          0: "0:0",
          1: "0:0",
          2: "0:0",
          3: "0:0",
          4: "0:0",
          5: "0:0",
        },
      },
      showModelPicture: true,
      lockCSS: generatedLevelDetails.lockCSS,
      lockHTML: generatedLevelDetails.lockHTML,
      lockJS: generatedLevelDetails.lockJS,
    };
    initialState.push(level);
  }
  return initialState;
};
