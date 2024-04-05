type question_and_answer = {
  question: string;
  answer: string;
};

export type scenario = {
  scenarioId: string;
  accuracy: number;
  // solutionData: ImageData;
  solutionUrl: string;
  // drawingData: ImageData;
  drawingUrl: string;
  differenceUrl: string;
  dimensions: {
    width: number;
    height: number;
  };
};

type instructions = string;
export interface Level {
  identifier: string;
  week: string;
  name: string;
  difficulty: string;
  completed: string;
  accuracy: number;
  buildingBlocks?: {
    pictures?: Array<string>;
    colors?: Array<string>;
  };
  code: {
    html: string;
    css: string;
    js: string;
  };
  solution: {
    html: string;
    css: string;
    js: string;
  };
  scenarios: scenario[];
  points: number;
  maxPoints: number;
  timeData: {
    startTime: number;
    pointAndTime: {
      [key: string]: string;
    };
  };
  help: {
    description: string;
    images: string[];
    usefullCSSProperties: string[];
  };
  confettiSprinkled: boolean;
  instructions: instructions;
  question_and_answer: question_and_answer;
  showModelPicture: boolean;
  lockCSS: boolean;
  lockHTML: boolean;
  lockJS: boolean;
  percentageTreshold: number;
  percentageFullPointsTreshold: number;
}

export type generator = (
  primaryColor: string,
  secondaryColor: string,
  tertiaryColor?: string
) => {
  THTML: string;
  SHTML: string;
  TCSS: string;
  SCSS: string;
  TJS?: string;
  SJS?: string;
  instructions: instructions;
  question_and_answer: question_and_answer;
  difficulty: string;
  lockCSS: boolean;
  lockHTML: boolean;
  lockJS: boolean;

  percentageTreshold: number;
  percentageFullPointsTreshold: number;
  colors: string[];
  dimensions: {
    width: number;
    height: number;
  }[];
};

export type levelNames =
  | "card"
  | "form"
  | "list"
  | "table"
  | "test"
  | "testFlex"
  | "flex"
  | "grid"
  | "Harder Flex"
  | "Harder Grid";
