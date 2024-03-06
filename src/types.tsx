export interface Level {
  id: number;
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
      [key: string]: number;
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
}
