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
const SNAP_DURATION_MS = 3500;
const POST_WAVE_FADE_MS = SNAP_DURATION_MS - 400;
// Worst case: petal born at delay 0.35 × SNAP + 6s life.
// Total = 0.35 × 3500 + 6000 = 7225ms. Round up for safety.
const TOTAL_EFFECT_MS = 7500;
const EXIT_LAYER_REMOVE_DELAY_MS = TOTAL_EFFECT_MS + 500;
const EXIT_BUFFER_AFTER_SNAP_MS = TOTAL_EFFECT_MS - SNAP_DURATION_MS + 500;
const SNAP_MAX_DISPLACEMENT_SCALE = 18;
const SNAP_MIN_PARTICLES = 150;
const SNAP_MAX_PARTICLES = 300;
const SNAP_MIN_PETALS = 35;
const SNAP_MAX_PETALS = 70;
const SNAP_MIN_DUST = 200;
const SNAP_MAX_DUST = 400;
const BASE_HERO_WORD_SIZE = 96;
const BASE_HERO_WORD_FADE_EDGE = 260;
const BASE_CLOUD_WORD_SIZE = 20;
const DEFAULT_CLOUD_WIDTH = 1500;
const DEFAULT_CLOUD_HEIGHT = 800;
const HERO_VARIANTS = ["Hello UI!", "Hello HTML!", "Hello CSS!", "Hello JS!"] as const;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type SnapParticle = {
  node: d3.Selection<SVGCircleElement, unknown, null, undefined>;
  startX: number;
  startY: number;
  seed: number;
  windStrength: number;
  riseSpeed: number;
  wobbleAmp: number;
  wobbleFreq: number;
  radius: number;
  delay: number;
};

type SnapPetal = {
  node: d3.Selection<SVGEllipseElement, unknown, null, undefined>;
  startX: number;
  startY: number;
  seed: number;
  windStrength: number;
  riseSpeed: number;
  wobbleAmp: number;
  wobbleFreq: number;
  radiusX: number;
  radiusY: number;
  spinSpeed: number;
  spinPhase: number;
  delay: number;
};

type SnapDust = {
  node: d3.Selection<SVGCircleElement, unknown, null, undefined>;
  startX: number;
  startY: number;
  seed: number;
  windStrength: number;
  riseSpeed: number;
  radius: number;
  delay: number;
};

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
    const layerCleanupTimeoutIds: ReturnType<typeof setTimeout>[] = [];
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
      layerCleanupTimeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      layerCleanupTimeoutIds.length = 0;
    };

    const runThanosSnap = (
      layerSvg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      dissolveTarget: d3.Selection<SVGGElement, unknown, null, undefined>,
      displacementNode: SVGFEDisplacementMapElement | null,
      stepFuncNode: SVGFEFuncAElement | null,
      particleColor: string
    ) => {
      if (!displacementNode || !stepFuncNode) {
        const fallbackTimeoutId = setTimeout(() => {
          const node = layerSvg.node();
          if (node?.isConnected) {
            node.remove();
          }
        }, EXIT_LAYER_REMOVE_DELAY_MS);
        layerCleanupTimeoutIds.push(fallbackTimeoutId);
        return;
      }

      stepFuncNode.setAttribute("intercept", "0");
      displacementNode.setAttribute("scale", "0");

      const heroTextNode = dissolveTarget.select<SVGTextElement>("text").node();
      const heroTextNodes = dissolveTarget.selectAll<SVGTextElement, unknown>("text.word-cloud-hero-outline");

      // Particle layer lives on the SVG root (outside the dissolve-filtered group)
      // but shares the same center-translate so coordinates match the text bbox.
      const dissolveTargetTransform = dissolveTarget.attr("transform") || "";
      const particleLayer = layerSvg
        .append("g")
        .attr("class", "word-cloud-snap-particles")
        .attr("transform", dissolveTargetTransform);
      const particles: SnapParticle[] = [];
      const petals: SnapPetal[] = [];
      const dust: SnapDust[] = [];

      if (heroTextNode) {
        const bbox = heroTextNode.getBBox();
        const area = bbox.width * bbox.height;
        const particleCount = Math.max(
          SNAP_MIN_PARTICLES,
          Math.min(SNAP_MAX_PARTICLES, Math.floor(area / 1000))
        );
        const petalCount = Math.max(
          SNAP_MIN_PETALS,
          Math.min(SNAP_MAX_PETALS, Math.floor(particleCount * 0.25))
        );
        const dustCount = Math.max(
          SNAP_MIN_DUST,
          Math.min(SNAP_MAX_DUST, Math.floor(area / 600))
        );

        // Dust — very tiny particles that rise and drift
        for (let i = 0; i < dustCount; i++) {
          const startX = bbox.x + Math.random() * bbox.width;
          const startY = bbox.y + Math.random() * bbox.height;
          const node = particleLayer
            .append("circle")
            .attr("cx", startX)
            .attr("cy", startY)
            .attr("r", 0)
            .attr("fill", particleColor)
            .style("opacity", 0);

          dust.push({
            node,
            startX,
            startY,
            seed: Math.random() * Math.PI * 2,
            windStrength: 20 + Math.random() * 60,
            riseSpeed: 15 + Math.random() * 45,
            radius: 0.3 + Math.random() * 0.7,
            delay: Math.random() * 0.6,
          });
        }

        // Particles — medium circles with wind, rise, and turbulent wobble
        for (let i = 0; i < particleCount; i++) {
          const startX = bbox.x + Math.random() * bbox.width;
          const startY = bbox.y + Math.random() * bbox.height;
          const node = particleLayer
            .append("circle")
            .attr("cx", startX)
            .attr("cy", startY)
            .attr("r", 0)
            .attr("fill", particleColor)
            .style("opacity", 0);

          particles.push({
            node,
            startX,
            startY,
            seed: Math.random() * Math.PI * 2,
            windStrength: 40 + Math.random() * 120,
            riseSpeed: 20 + Math.random() * 80,
            wobbleAmp: 8 + Math.random() * 24,
            wobbleFreq: 2 + Math.random() * 4,
            radius: 0.6 + Math.random() * 2.0,
            delay: Math.random() * 0.45,
          });
        }

        // Petals — ellipses with multi-axis spin and wind drift
        const petalColors = ["#f2f2f2", "#e8c4c8", "#bb6b70", "#d4948a", "#c9a0a0"];
        for (let i = 0; i < petalCount; i++) {
          const startX = bbox.x + Math.random() * bbox.width;
          const startY = bbox.y + Math.random() * bbox.height;
          const node = particleLayer
            .append("ellipse")
            .attr("cx", startX)
            .attr("cy", startY)
            .attr("rx", 0)
            .attr("ry", 0)
            .attr("fill", petalColors[i % petalColors.length])
            .style("opacity", 0);

          petals.push({
            node,
            startX,
            startY,
            seed: Math.random() * Math.PI * 2,
            windStrength: 50 + Math.random() * 160,
            riseSpeed: 30 + Math.random() * 100,
            wobbleAmp: 12 + Math.random() * 30,
            wobbleFreq: 1.5 + Math.random() * 3,
            radiusX: 1.4 + Math.random() * 3.0,
            radiusY: 0.6 + Math.random() * 1.8,
            spinSpeed: 120 + Math.random() * 300,
            spinPhase: Math.random() * 360,
            delay: Math.random() * 0.35,
          });
        }
      }

      const startTime = performance.now();

      // Particle lifetimes (seconds) — independent of dissolve duration.
      // Matches the article: dust=4s, particles=4s, petals=6s.
      const DUST_LIFE = 4;
      const PARTICLE_LIFE = 4;
      const PETAL_LIFE = 6;
      const snapDurationSec = SNAP_DURATION_MS / 1000;

      const animateSnap = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const dissolveProgress = Math.min(1, elapsed / SNAP_DURATION_MS);
        const totalProgress = elapsed / TOTAL_EFFECT_MS;

        // --- Text dissolve (runs for SNAP_DURATION_MS) ---
        if (dissolveProgress < 1) {
          const dissolveOvershoot = dissolveProgress * 1.15;
          const stepIntercept = -dissolveOvershoot * 200;
          stepFuncNode.setAttribute("intercept", stepIntercept.toFixed(2));

          const displacementScale = dissolveProgress * SNAP_MAX_DISPLACEMENT_SCALE;
          displacementNode.setAttribute("scale", String(displacementScale));
        }

        // --- Particles: each has birth time (delay * snapDuration) and own lifetime ---

        // Dust — 4s lifetime
        dust.forEach((d) => {
          const birthSec = d.delay * snapDurationSec;
          const age = elapsed / 1000 - birthSec;
          if (age <= 0) return;
          const lp = Math.min(1, age / DUST_LIFE);

          const wind = d.windStrength * age;
          const rise = d.riseSpeed * age;
          const x = d.startX + wind;
          const y = d.startY - rise;
          const scaleIn = Math.min(1, lp / 0.03);
          const fadeOut = lp > 0.8 ? 1 - (lp - 0.8) / 0.2 : 1;
          const r = d.radius * scaleIn;

          d.node
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", r)
            .style("opacity", Math.max(0, fadeOut * 0.6));
        });

        // Particles — 4s lifetime
        particles.forEach((p) => {
          const birthSec = p.delay * snapDurationSec;
          const age = elapsed / 1000 - birthSec;
          if (age <= 0) return;
          const lp = Math.min(1, age / PARTICLE_LIFE);

          const wind = p.windStrength * age;
          const rise = p.riseSpeed * age;
          const wobbleX = p.wobbleAmp * Math.sin(age * p.wobbleFreq + p.seed);
          const wobbleY = p.wobbleAmp * 0.7 * Math.cos(age * p.wobbleFreq * 1.3 + p.seed + 1.7);
          const x = p.startX + wind + wobbleX;
          const y = p.startY - rise + wobbleY;
          const scaleIn = Math.min(1, lp / 0.03);
          const fadeOut = lp > 0.8 ? 1 - (lp - 0.8) / 0.2 : 1;
          const life = 1 - lp;
          const r = p.radius * scaleIn * (0.4 + 0.6 * life);

          p.node
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", r)
            .style("opacity", Math.max(0, Math.pow(fadeOut, 1.3)));
        });

        // Petals — 6s lifetime
        petals.forEach((pt) => {
          const birthSec = pt.delay * snapDurationSec;
          const age = elapsed / 1000 - birthSec;
          if (age <= 0) return;
          const lp = Math.min(1, age / PETAL_LIFE);

          const wind = pt.windStrength * age;
          const rise = pt.riseSpeed * age;
          const wobbleX = pt.wobbleAmp * Math.sin(age * pt.wobbleFreq + pt.seed);
          const wobbleY = pt.wobbleAmp * 0.6 * Math.cos(age * pt.wobbleFreq * 1.1 + pt.seed + 2.1);
          const x = pt.startX + wind + wobbleX;
          const y = pt.startY - rise + wobbleY;
          const life = 1 - lp;

          const scaleIn = Math.min(1, lp / 0.04);
          const rx = pt.radiusX * scaleIn * (0.5 + 0.5 * life);
          const ry = pt.radiusY * scaleIn * (0.4 + 0.6 * life);

          const spin = pt.spinPhase + pt.spinSpeed * lp;
          const breathe = Math.sin(age * 3.5 + pt.seed) * 0.3;
          const rxFinal = rx * (1 + breathe);
          const ryFinal = ry * (1 - breathe * 0.5);

          const fadeOut = lp > 0.8 ? 1 - (lp - 0.8) / 0.2 : 1;

          pt.node
            .attr("cx", x)
            .attr("cy", y)
            .attr("rx", Math.max(0, rxFinal))
            .attr("ry", Math.max(0, ryFinal))
            .attr("transform", `rotate(${spin.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`)
            .style("opacity", Math.max(0, Math.pow(fadeOut, 1.1)));
        });

        if (totalProgress < 1 && !isUnmounted) {
          requestAnimationFrame(animateSnap);
          return;
        }

        displacementNode.setAttribute("scale", "0");
        const node = layerSvg.node();
        if (node) {
          const cleanupTimeoutId = setTimeout(() => {
            if (node.isConnected) {
              node.remove();
            }
          }, EXIT_BUFFER_AFTER_SNAP_MS);
          layerCleanupTimeoutIds.push(cleanupTimeoutId);
        }
      };

      requestAnimationFrame(animateSnap);
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

      const previousActiveLayer = d3
        .select(container)
        .select<SVGSVGElement>("svg.word-cloud-cycle--active");

      if (!previousActiveLayer.empty()) {
        previousActiveLayer
          .classed("word-cloud-cycle--active", false)
          .classed("word-cloud-cycle--exiting", true);
        const exitingLayerNode = previousActiveLayer.node();
        if (exitingLayerNode) {
          const cleanupTimeoutId = setTimeout(() => {
            if (exitingLayerNode.isConnected) {
              exitingLayerNode.remove();
            }
          }, EXIT_LAYER_REMOVE_DELAY_MS);
          layerCleanupTimeoutIds.push(cleanupTimeoutId);
        }
      }

      const svg = d3
        .select(container)
        .append("svg")
        .attr("class", "word-cloud-cycle word-cloud-cycle--active")
        .attr("width", cloudWidth)
        .attr("height", cloudHeight);

      if (!previousActiveLayer.empty()) {
        svg.lower();
      }

      const defs = svg.append("defs");

      const heroGradient = defs
        .append("linearGradient")
        .attr("id", heroGradientId)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

      const dissolveFilterId = `word-cloud-dissolve-${Math.random().toString(36).slice(2)}`;
      const dissolveFilter = defs
        .append("filter")
        .attr("id", dissolveFilterId)
        .attr("x", "-30%")
        .attr("y", "-30%")
        .attr("width", "160%")
        .attr("height", "160%");

      // -- Noise-threshold dissolve (ported from WebGPU gommage effect) --
      //
      // The article does:  remapped = clamp((noise - 0.48) / (0.9 - 0.48), 0, 1)
      //                    dissolve = step(progress, remapped)
      //
      // SVG feTurbulence fractalNoise values cluster around 0.5 in a narrow
      // range (~0.3–0.7).  We must remap that range to [0,1] FIRST so the
      // threshold sweeps evenly, then do a hard step.
      //
      // SVG pipeline:
      //   1. feTurbulence  →  raw noise
      //   2. feComponentTransfer  →  remap R channel:  out = clamp(R * slope + intercept)
      //        slope = 1/(noiseMax - noiseMin),  intercept = -noiseMin * slope
      //        For range [0.3, 0.7]:  slope = 2.5,  intercept = -0.75
      //   3. feColorMatrix  →  copy remapped R into alpha (for threshold)
      //   4. feComponentTransfer  →  step:  alpha = clamp((alpha - progress) * bigSlope)
      //   5. feComposite in  →  mask SourceGraphic

      // feTurbulence fractalNoise with 2 octaves produces values roughly
      // in [0.25, 0.75].  Widen the remap window so the brightest noise
      // still maps to ≤ 1.0 — otherwise those pixels never dissolve.
      const NOISE_MIN = 0.2;
      const NOISE_MAX = 0.8;
      const remapSlope = 1 / (NOISE_MAX - NOISE_MIN);
      const remapIntercept = -NOISE_MIN * remapSlope;

      // 1. Generate fractal noise
      dissolveFilter
        .append("feTurbulence")
        .attr("type", "fractalNoise")
        .attr("baseFrequency", "0.022 0.028")
        .attr("numOctaves", "2")
        .attr("seed", String(Math.floor(Math.random() * 10000)))
        .attr("result", "noise");

      // 2. Remap noise R from [0.3, 0.7] → [0, 1]
      const remapTransfer = dissolveFilter.append("feComponentTransfer")
        .attr("in", "noise")
        .attr("result", "remapped");
      remapTransfer.append("feFuncR")
        .attr("type", "linear")
        .attr("slope", String(remapSlope))
        .attr("intercept", String(remapIntercept));

      // 3. Move remapped R into alpha channel:  A = R_remapped
      dissolveFilter
        .append("feColorMatrix")
        .attr("type", "matrix")
        .attr("in", "remapped")
        .attr("values", "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0")
        .attr("result", "noiseAlpha");

      // 4. Hard step: alpha = clamp((noiseAlpha - progress) * 200)
      //    Animated by updating intercept each frame:
      //    slope=200, intercept = -progress * 200
      //    At progress=0: everything visible.  At progress=1: everything gone.
      const dissolveStep = dissolveFilter.append("feComponentTransfer")
        .attr("in", "noiseAlpha")
        .attr("result", "mask");
      const dissolveStepFunc = dissolveStep.append("feFuncA")
        .attr("type", "linear")
        .attr("slope", "200")
        .attr("intercept", "0");

      // 5. Mask source graphic with the dissolve mask
      dissolveFilter
        .append("feComposite")
        .attr("operator", "in")
        .attr("in", "SourceGraphic")
        .attr("in2", "mask")
        .attr("result", "dissolved");

      // 6. Mild displacement for organic warping at edges
      const dissolveDisplacement = dissolveFilter
        .append("feDisplacementMap")
        .attr("in", "dissolved")
        .attr("in2", "noise")
        .attr("scale", "0")
        .attr("xChannelSelector", "R")
        .attr("yChannelSelector", "G");

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

      const heroOutlineLayer = svg
        .append("g")
        .attr(
          "transform",
          "translate(" + cloudWidth / 2 + "," + cloudHeight / 2 + ")"
        );

      const heroOutlineNodes = heroOutlineLayer
        .selectAll("text")
        .data(centeredWords.filter((d) => d.text === heroWord))
        .enter()
        .append("text")
        .attr("class", "word-cloud-hero-outline")
        .style("font-size", function (d: CloudWord) {
          return d.size + "px";
        })
        .style("font-family", "Impact")
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
          // Hide the filled hero text INSTANTLY — must kill the CSS
          // transition first, otherwise it fades over 2200ms and bleeds
          // through the holes the dissolve filter is cutting above it.
          textNodes
            .filter((d: CloudWord) => d.text === activeWaveHeroWordRef.current)
            .style("transition", "none")
            .style("opacity", 0);
          heroOutlineLayer
            .classed("word-cloud-hero-outline-layer", true)
            .style("filter", `url(#${dissolveFilterId})`);
          // Switch outline text to solid fill so the noise-threshold dissolve
          // cuts visible chunks, not just thin stroke segments.
          heroOutlineNodes
            .classed("word-cloud-hero-outline-dissolving", true)
            .classed("word-cloud-hero-outline-exit", true)
            .style("fill", featuredActiveFill)
            .style("stroke", "none")
            .style("opacity", "1");
          svg
            .classed("word-cloud-cycle--active", false)
            .classed("word-cloud-cycle--exiting", true);
          runThanosSnap(
            svg,
            heroOutlineLayer,
            dissolveDisplacement.node() as SVGFEDisplacementMapElement | null,
            dissolveStepFunc.node() as SVGFEFuncAElement | null,
            featuredActiveFill
          );
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
