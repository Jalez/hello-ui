type question_and_answer = {
  question: string;
  answer: string;
};

type instructions = string;
export interface Level {
  identifier: string;
  week: string;
  name: string;
  completed: string;
  accuracy: string;
  buildingBlocks?: {
    pictures?: Array<string>;
    colors?: Array<string>;
  };
  code: {
    html: string;
    css: string;
  };
  solution: {
    html: string;
    css: string;
  };
  image: string;
  diff: string;
  difficulty: string;
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
  drawingUrl: string;
  solutionUrl: string;
  drawnEvalUrl: string;
  solEvalUrl: string;
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
  instructions: instructions;
  question_and_answer: question_and_answer;
  difficulty: string;
};

export type levelNames = "card" | "form" | "list" | "table";
