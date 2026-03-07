/** @format */
'use client';

import { WordCloud } from "./WordCloud/WordCloud";
import { cssPropertiesArray } from "./CSSProperties";
import {
  htmlVocabularyArray,
  javascriptVocabularyArray,
  uiVocabularyArray,
} from "./CloudVocabularies";

export const CSSWordCloud = () => {
  const featuredWords = [
    "MASTER CSS",
    "LEARN HTML",
    "DISCOVER JAVASCRIPT",
    "BUILD UI CHALLENGES",
    "TRAIN YOUR EYE FOR DESIGN",
    "PRACTICE RESPONSIVE LAYOUTS",
    "DEBUG LIKE A FRONTEND DEV",
    "CREATE PIXEL PERFECT SCREENS",
    "IMPROVE WITH EVERY ITERATION",
    "SHIP INTERFACES WITH CONFIDENCE",
  ];

  return (
    <div className="absolute inset-0 z-0 m-0 w-full h-full">
      <WordCloud
        words={cssPropertiesArray}
        featuredWords={featuredWords}
        wordsByHero={{
          "Hello UI!": uiVocabularyArray,
          "Hello HTML!": htmlVocabularyArray,
          "Hello CSS!": cssPropertiesArray,
          "Hello JS!": javascriptVocabularyArray,
        }}
      />
    </div>
  );
};
