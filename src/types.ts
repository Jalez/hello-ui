type question_and_answer = {
  question: string;
  answer: string;
};

export type scenario = {
  scenarioId: string;
  accuracy: number;
  dimensions: {
    width: number;
    height: number;
  };
  js: string;
};

export type difficulty = "easy" | "medium" | "hard";

type instructionSection = {
  title: string;
  content: string[];
};

type instructions = instructionSection[];
export interface Level {
  identifier: string;
  week: string;
  name: levelNames;
  difficulty: difficulty;
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
  interactive: boolean;
  showScenarioModel: boolean;
  showHotkeys: boolean;
  events: string[];
  percentageTreshold: number;
  percentageFullPointsTreshold: number;
}

export type generator = () => {
  THTML: string;
  SHTML: string;
  TCSS: string;
  SCSS: string;
  TJS?: string;
  SJS?: string;
  events?: string[];
  instructions: instructions;
  question_and_answer: question_and_answer;
  difficulty: difficulty;
  name: levelNames;
  lockCSS: boolean;
  lockHTML: boolean;
  lockJS: boolean;
  percentageTreshold: number;
  percentageFullPointsTreshold: number;
  colors: string[];
  scenarioDetails: {
    width: number;
    height: number;
    js?: string;
  }[];
};

export type levelNames =
  | "Easy card"
  | "Medium form"
  | "Medium list"
  | "Easy table"
  | "test"
  | "Easy flex"
  | "Hard flex"
  | "Easy grid"
  | "Hard grid"
  | "Hard form"
  | "Dynamic list"
  | "Medium Navbar"
  | "Easy sidebar"
  | "Exam flex"
  | "Exam grid";

export type MapDetails = {
  levels: string[];
  canUseAI: boolean;
  random: number;
};
