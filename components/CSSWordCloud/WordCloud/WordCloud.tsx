/** @format */

import { useEffect, useRef } from "react";
// import d3
import d3Cloud from "d3-cloud";
import * as d3 from "d3";
import "./WordCloud.css";
// const as = d3Cloud_ as any;
// include namespace for d3-cloud
// import { d3 } from 'd3-cloud';

const loremIpsum = `Lorem ipsum
`;

// Get the words from the text
const loremWords = loremIpsum.split(" ").map((word) => {
  return word;
});

type WordCloudProps = {
  words?: string[];
  featuredWords?: string[];
  wordsByHero?: Partial<Record<(typeof HERO_VARIANTS)[number], string[]>>;
};

type CloudWord = {
  text: string;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
};

const WAVE_DURATION_MS = 10000;
const WAVE_BAND_WIDTH = 360;
const POST_WAVE_FADE_MS = 2600;
const BASE_HERO_WORD_SIZE = 96;
const BASE_HERO_WORD_FADE_EDGE = 260;
const BASE_CLOUD_WORD_SIZE = 20;
const DEFAULT_CLOUD_WIDTH = 1500;
const DEFAULT_CLOUD_HEIGHT = 800;
const HERO_VARIANTS = ["Hello UI!", "Hello HTML!", "Hello CSS!", "Hello JS!"] as const;

export const WordCloud = ({
  words = loremWords,
  featuredWords = [],
  wordsByHero,
}: WordCloudProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeWaveHeroWordRef = useRef<string>(HERO_VARIANTS[0]);
  const previousHeroWordRef = useRef<string>(HERO_VARIANTS[0]);
  const activeWaveFeaturedWordsRef = useRef<string[]>([]);
  const activeWaveFeaturedDiscoveredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let waveAnimationFrameId: number | null = null;
    let nextCycleTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let isUnmounted = false;
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const rotatingFeaturedWords = featuredWords;
    let cloudWidth = container.clientWidth || DEFAULT_CLOUD_WIDTH;
    let cloudHeight = container.clientHeight || DEFAULT_CLOUD_HEIGHT;
    let heroWordSize = BASE_HERO_WORD_SIZE;
    let heroWordFadeEdge = BASE_HERO_WORD_FADE_EDGE;
    let cloudWordSize = BASE_CLOUD_WORD_SIZE;

    const updateResponsiveWordSizing = () => {
      let scale = 1;
      if (cloudWidth <= 640) {
        scale = 0.5;
      } else if (cloudWidth <= 960) {
        scale = 0.75;
      }
      heroWordSize = Math.round(BASE_HERO_WORD_SIZE * scale);
      heroWordFadeEdge = Math.round(BASE_HERO_WORD_FADE_EDGE * scale);
      cloudWordSize = Math.max(12, Math.round(BASE_CLOUD_WORD_SIZE * Math.max(0.75, scale)));
    };

    const updateCloudSize = () => {
      cloudWidth = container.clientWidth || DEFAULT_CLOUD_WIDTH;
      cloudHeight = container.clientHeight || DEFAULT_CLOUD_HEIGHT;
      updateResponsiveWordSizing();
    };

    const clearCycleTimers = () => {
      if (waveAnimationFrameId !== null) {
        cancelAnimationFrame(waveAnimationFrameId);
        waveAnimationFrameId = null;
      }
      if (nextCycleTimeoutId) {
        clearTimeout(nextCycleTimeoutId);
        nextCycleTimeoutId = null;
      }
    };

    function draw(layoutWords: CloudWord[]) {
      const heroWord = activeWaveHeroWordRef.current;
      const activeWaveFeaturedWords = activeWaveFeaturedWordsRef.current;
      const activeWaveFeaturedSet = new Set(activeWaveFeaturedWords);
      const heroGradientId = `word-cloud-hero-gradient-${Math.random().toString(36).slice(2)}`;
      const featuredActiveFill =
        getComputedStyle(container).getPropertyValue("--wc-featured-active-fill").trim() || "#111";
      const heroLayoutWord = heroWord
        ? layoutWords.find((word) => word.text === heroWord)
        : null;
      const xOffset = heroLayoutWord?.x ?? 0;
      const yOffset = heroLayoutWord?.y ?? 0;
      const centeredWords = layoutWords.map((word) => ({
        ...word,
        x: (word.x ?? 0) - xOffset,
        y: (word.y ?? 0) - yOffset,
      }));

      d3.select(container)
        .selectAll("*")
        .remove();

      const svg = d3
        .select(container)
        .append("svg")
        .attr("width", cloudWidth)
        .attr("height", cloudHeight);

      const heroGradient = svg
        .append("defs")
        .append("linearGradient")
        .attr("id", heroGradientId)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

      const heroStops = [
        heroGradient.append("stop").attr("offset", "0%"),
        heroGradient.append("stop").attr("offset", "0%"),
        heroGradient.append("stop").attr("offset", "0%"),
        heroGradient.append("stop").attr("offset", "100%"),
      ];

      const textNodes = svg
        .append("g")
        .attr(
          "transform",
          "translate(" + cloudWidth / 2 + "," + cloudHeight / 2 + ")"
        )
        .selectAll("text")
        .data(centeredWords)
        .enter()
        .append("text")
        .attr("class", "word-cloud-text")
        .classed("word-cloud-featured", (d: CloudWord) => {
          return d.text === heroWord || activeWaveFeaturedSet.has(d.text);
        })
        .classed("word-cloud-featured-active", (d: CloudWord) => {
          if (d.text === heroWord) return false;
          if (activeWaveFeaturedSet.has(d.text)) {
            return activeWaveFeaturedDiscoveredRef.current.has(d.text);
          }
          return false;
        })
        .classed("word-cloud-hero", (d: CloudWord) => d.text === heroWord)
        .classed("word-cloud-wave-visible", (d: CloudWord) => {
          if (d.text === heroWord) return false;
          if (activeWaveFeaturedSet.has(d.text)) {
            return activeWaveFeaturedDiscoveredRef.current.has(d.text);
          }
          return false;
        })
        .style("font-size", function (d: CloudWord) {
          return d.size + "px";
        })
        .style("font-family", "Impact")
        .style("fill", function (d: CloudWord) {
          if (d.text === heroWord) {
            return `url(#${heroGradientId})`;
          }
          return null;
        })
        .attr("text-anchor", "middle")
        .attr("transform", function (d: CloudWord) {
          return "translate(" + [d.x ?? 0, d.y ?? 0] + ")rotate(" + (d.rotate ?? 0) + ")";
        })
        .text(function (d: CloudWord) {
          return d.text;
        });

      const leftBoundary = -cloudWidth / 2;
      const rightBoundary = cloudWidth / 2;
      const totalTravelDistance = rightBoundary - leftBoundary + WAVE_BAND_WIDTH;
      const startWaveAt = performance.now();

      const applyCurrentWaveState = (leadX: number) => {
        const trailX = leadX - WAVE_BAND_WIDTH;
        const heroWordInWave = activeWaveHeroWordRef.current;
        const currentWaveFeaturedWords = activeWaveFeaturedWordsRef.current;
        const currentWaveFeaturedSet = new Set(currentWaveFeaturedWords);

        const heroNode = centeredWords.find((word) => word.text === heroWordInWave);
        const heroX = heroNode?.x ?? 0;
        const heroFadeStart = heroX - heroWordFadeEdge;
        const heroFadeEnd = heroX + heroWordFadeEdge;
        const heroProgress =
          heroFadeEnd > heroFadeStart
            ? Math.max(0, Math.min(1, (leadX - heroFadeStart) / (heroFadeEnd - heroFadeStart)))
            : 0;
        const easedHeroOpacity = heroProgress * heroProgress * (3 - 2 * heroProgress);
        const gradientHead = heroProgress * 100;
        const featherWidth = 2 + 18 * (1 - heroProgress);
        const gradientTail = Math.max(0, gradientHead - featherWidth);

        heroStops[0].attr("offset", "0%").attr("stop-color", featuredActiveFill).attr("stop-opacity", 1);
        heroStops[1]
          .attr("offset", `${gradientTail}%`)
          .attr("stop-color", featuredActiveFill)
          .attr("stop-opacity", 1);
        heroStops[2]
          .attr("offset", `${gradientHead}%`)
          .attr("stop-color", featuredActiveFill)
          .attr("stop-opacity", 0);
        heroStops[3].attr("offset", "100%").attr("stop-color", featuredActiveFill).attr("stop-opacity", 0);

        textNodes
          .filter((d: CloudWord) => d.text === heroWordInWave)
          .style("opacity", easedHeroOpacity);
        currentWaveFeaturedWords.forEach((featuredWord) => {
          const currentWaveFeaturedNode = centeredWords.find((word) => word.text === featuredWord);
          const currentWaveFeaturedX = currentWaveFeaturedNode?.x ?? Infinity;
          if (leadX >= currentWaveFeaturedX) {
            activeWaveFeaturedDiscoveredRef.current.add(featuredWord);
          }
        });

        textNodes.classed("word-cloud-wave-visible", (d: CloudWord) => {
          if (d.text === heroWordInWave) return false;
          if (currentWaveFeaturedSet.has(d.text)) {
            return activeWaveFeaturedDiscoveredRef.current.has(d.text);
          }
          const x = d.x ?? 0;
          return x <= leadX && x >= trailX;
        });
        textNodes.classed("word-cloud-featured-active", (d: CloudWord) => {
          if (d.text === heroWordInWave) return false;
          if (currentWaveFeaturedSet.has(d.text)) {
            return activeWaveFeaturedDiscoveredRef.current.has(d.text);
          }
          const x = d.x ?? 0;
          return x <= leadX && x >= trailX;
        });
      };

      applyCurrentWaveState(leftBoundary);

      const runWaveFrame = () => {
        const elapsed = performance.now() - startWaveAt;
        const progress = Math.min(1, elapsed / WAVE_DURATION_MS);
        const leadX = leftBoundary + totalTravelDistance * progress;

        applyCurrentWaveState(leadX);

        if (progress >= 1) {
          if (waveAnimationFrameId !== null) {
            cancelAnimationFrame(waveAnimationFrameId);
          }
          waveAnimationFrameId = null;
          const endingWaveFeaturedSet = new Set(activeWaveFeaturedWordsRef.current);
          textNodes.classed("word-cloud-wave-visible", (d: CloudWord) => {
            if (d.text === activeWaveHeroWordRef.current) return false;
            return false;
          });
          textNodes.classed("word-cloud-featured-active", (d: CloudWord) => {
            if (d.text === activeWaveHeroWordRef.current) return false;
            if (endingWaveFeaturedSet.has(d.text)) {
              return false;
            }
            return false;
          });
          textNodes
            .filter((d: CloudWord) => d.text === activeWaveHeroWordRef.current)
            .style("opacity", 0);
          if (nextCycleTimeoutId) {
            clearTimeout(nextCycleTimeoutId);
          }
          nextCycleTimeoutId = setTimeout(() => {
            if (!isUnmounted) {
              startCloudCycle();
            }
          }, POST_WAVE_FADE_MS);
          return;
        }

        waveAnimationFrameId = requestAnimationFrame(runWaveFrame);
      };

      waveAnimationFrameId = requestAnimationFrame(runWaveFrame);
    }

    function startCloudCycle() {
      updateCloudSize();

      const availableHeroWords = HERO_VARIANTS.filter(
        (variant) => variant !== previousHeroWordRef.current
      );
      const randomHeroWordPool =
        availableHeroWords.length > 0 ? availableHeroWords : HERO_VARIANTS;
      const randomHeroWord =
        randomHeroWordPool[Math.floor(Math.random() * randomHeroWordPool.length)];
      previousHeroWordRef.current = randomHeroWord;
      activeWaveHeroWordRef.current = randomHeroWord;
      const scopedWords = wordsByHero?.[randomHeroWord] ?? words;
      const baseWords = Array.from(new Set(scopedWords));

      const activeWaveFeaturedWords = [...rotatingFeaturedWords];
      for (let i = activeWaveFeaturedWords.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [activeWaveFeaturedWords[i], activeWaveFeaturedWords[randomIndex]] = [
          activeWaveFeaturedWords[randomIndex],
          activeWaveFeaturedWords[i],
        ];
      }
      const activeCount =
        activeWaveFeaturedWords.length <= 2
          ? activeWaveFeaturedWords.length
          : Math.random() < 0.5
            ? 2
            : 3;
      const selectedWaveFeaturedWords = activeWaveFeaturedWords.slice(0, activeCount);
      activeWaveFeaturedWordsRef.current = selectedWaveFeaturedWords;
      activeWaveFeaturedDiscoveredRef.current = new Set();

      const cycleWords = Array.from(
        new Set(
          [
            ...baseWords,
            activeWaveHeroWordRef.current,
            ...selectedWaveFeaturedWords,
          ].filter((word): word is string => Boolean(word))
        )
      );

      const layout = d3Cloud()
        .size([cloudWidth, cloudHeight])
        .words(
          cycleWords.map(function (d: string) {
            if (d === activeWaveHeroWordRef.current) {
              return { text: d, size: heroWordSize };
            }
            if (selectedWaveFeaturedWords.includes(d)) {
              return { text: d, size: cloudWordSize };
            }
            return { text: d, size: cloudWordSize };
          })
        )
        .padding(1)
        .rotate(function (d: CloudWord) {
          if (d.text === activeWaveHeroWordRef.current || selectedWaveFeaturedWords.includes(d.text)) {
            return d.rotate ?? 0;
          }
          return ~~(Math.random() * 2) * 90;
        })
        .font("Impact")
        .fontSize(function (d: CloudWord) {
          return d.size;
        })
        .on("end", draw);

      layout.start();
    }

    startCloudCycle();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (isUnmounted) {
          return;
        }
        // Do not interrupt an ongoing wave when layout width changes (e.g. sidebar toggle).
        // The next normal cycle will pick up the new container size via updateCloudSize().
        updateCloudSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      isUnmounted = true;
      clearCycleTimers();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      d3.select(container).selectAll("*").remove();
    };
  }, [featuredWords, words, wordsByHero]);

  return <div ref={containerRef} className="word-cloud-root w-full h-full" />;
};
