"use client";

import { useEffect, useState } from "react";

/*
  The pixel scene — two of them, actually.

  In light mode the rabbit fishes from a dock on a river. In dark mode it is
  night, and the same rabbit is sat at a campfire in a clearing. Both are
  rendered into the SVG and CSS shows one; see the `.scene-day` / `.scene-night`
  rules in `app/globals.css`. Toggling with CSS rather than with `useTheme()`
  means the correct scene is in the server-rendered HTML and there is no
  hydration mismatch and no flash of the wrong season.

  Everything is drawn on an integer grid with `shapeRendering="crispEdges"`,
  which is what keeps the edges hard when the SVG scales. There is no raster
  asset: fills reference the palette tokens, so the artwork rethemes with the
  rest of the product rather than shipping two copies of every sprite.

  The animation is gated behind `data-animate`, set in an effect after mount.
  `app/globals.css` records that an infinite animation stops a Lighthouse
  filmstrip ever reaching visual completeness — measured at a 20.8s Speed Index
  against a 3.9s LCP — which is why the skeleton pulse is capped at four
  iterations. An infinite loop on the largest element of the landing page would
  reintroduce exactly that. Rendering static and starting the loop after mount
  keeps the measured paint still.

  Every animated element's *base* style is its idle state, so each scene is a
  complete picture with no animation running at all: a rabbit fishing, or a
  rabbit at a lit fire. That is what `prefers-reduced-motion` falls back to, and
  it is also the server-rendered frame.
*/

/* Vertical bands, in viewBox units. Shared by both scenes so the horizon, the
   treeline and the rabbit sit at the same height in each. */
const WIDTH = 640;
const HEIGHT = 150;
const HORIZON = 100;
const BANK_TOP = 92;

/** Rabbit's feet: the dock in the day scene, the ground at night. */
const DOCK_TOP = 96;
const CAMP_GROUND = 112;

/**
 * A conifer as stacked rectangles, widening toward the base.
 *
 * Generated rather than hand-drawn so the treeline's density is a matter of
 * editing `treeline()` below. The rabbit is the opposite case and stays
 * explicit — it is the character, and a generator would not place its ear right.
 */
function Conifer({
  cx,
  baseY,
  rows,
  unit,
  fill,
}: {
  cx: number;
  baseY: number;
  rows: number;
  unit: number;
  fill: string;
}) {
  const trunkH = unit;
  const treeBottom = baseY - trunkH;

  return (
    <g>
      <rect
        x={cx - Math.round(unit / 2)}
        y={treeBottom}
        width={unit}
        height={trunkH}
        fill="var(--bark)"
      />
      {Array.from({ length: rows }, (_, i) => {
        const w = unit * (i + 2);
        return (
          <rect
            key={i}
            x={cx - Math.round(w / 2)}
            y={treeBottom - (rows - i) * unit}
            width={w}
            height={unit}
            fill={fill}
          />
        );
      })}
    </g>
  );
}

/** The clearing the rabbit sits in — no trees are drawn between these. */
const CLEARING: readonly [number, number] = [236, 404];

/**
 * A treeline across the full width, opening into the clearing.
 *
 * Generated rather than listed because at this width it is thirty-odd trees,
 * and a hand-written list is a thing nobody will ever adjust. Heights vary on
 * index parity instead of `Math.random`, which would give the server and the
 * client different trees and hydrate into a mismatch.
 */
function treeline(
  step: number,
  offset: number,
  rows: readonly [number, number],
): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let x = offset; x < WIDTH + step; x += step) {
    if (x > CLEARING[0] && x < CLEARING[1]) continue;
    out.push([x, rows[x % 3 === 0 ? 1 : 0] ?? rows[0]]);
  }
  return out;
}

const TREES_BACK = treeline(26, 8, [5, 6]);
const TREES_FRONT = treeline(31, 20, [6, 7]);

function Treeline({ back, front }: { back: string; front: string }) {
  return (
    <>
      {TREES_BACK.map(([cx, rows]) => (
        <Conifer key={`b${cx}`} cx={cx} baseY={BANK_TOP + 4} rows={rows} unit={4} fill={back} />
      ))}
      {TREES_FRONT.map(([cx, rows]) => (
        <Conifer key={`f${cx}`} cx={cx} baseY={HORIZON} rows={rows} unit={5} fill={front} />
      ))}
    </>
  );
}

/*
  Pixel clouds: [x, y, w, h] runs, stacked into blocky shapes.

  Kept clear of x 230–350, which is where the sign pops. A cloud behind it is
  not wrong exactly, but the sign is cream on cream and loses its edge on one.
*/
const CLOUDS: ReadonlyArray<readonly [number, number, number, number]> = [
  [56, 34, 44, 6], [48, 40, 60, 6], [68, 28, 26, 6],
  [150, 30, 52, 6], [140, 36, 70, 6], [166, 24, 30, 6],
  [452, 32, 46, 6], [444, 38, 62, 6], [466, 26, 26, 6],
  [556, 36, 40, 6], [548, 42, 54, 6],
];

/**
 * The rabbit, in local coordinates on a 20×26 grid. Drawn in profile facing
 * right, seated, with one paw held out in front.
 *
 * That forward paw does double duty: it holds the rod in the day scene and is
 * held out to the fire at night. One sprite, two readings — which is the whole
 * reason the night scene puts the fire on the rabbit's right.
 *
 * Drawn large rather than drawn small and scaled up: a non-integer transform on
 * a `crispEdges` sprite lands rect boundaries on half pixels and hairline seams
 * open up between them.
 */
const RABBIT_H = 26;

const RABBIT: ReadonlyArray<{
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
}> = [
  // Ears — the back one is shorter so the two read as separate at this size.
  { x: 5, y: 0, w: 3, h: 9, c: "var(--fur)" },
  { x: 9, y: 3, w: 3, h: 6, c: "var(--fur)" },
  { x: 6, y: 2, w: 1, h: 5, c: "var(--accent-soft)" },
  // Head, muzzle, eye.
  { x: 4, y: 8, w: 11, h: 8, c: "var(--fur)" },
  { x: 15, y: 12, w: 2, h: 3, c: "var(--fur)" },
  { x: 11, y: 11, w: 2, h: 2, c: "var(--fg)" },
  // Body, arm, paw.
  { x: 3, y: 15, w: 13, h: 8, c: "var(--accent-soft)" },
  { x: 14, y: 17, w: 4, h: 3, c: "var(--accent-soft)" },
  { x: 18, y: 17, w: 2, h: 3, c: "var(--fur)" },
  // Tail and legs.
  { x: 1, y: 17, w: 2, h: 3, c: "var(--fur)" },
  { x: 3, y: 23, w: 14, h: 3, c: "var(--fur)" },
];

function Rabbit({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {RABBIT.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c} />
      ))}
    </g>
  );
}

/**
 * A hand-lettered sign that pops above the rabbit.
 *
 * Several are rendered per scene, each hidden at rest and each given a stagger
 * so exactly one is up at a time — see `scene-say` in `app/globals.css`. One
 * line repeating forever is the thing that makes a loop feel like a loop;
 * four turns it into something you catch a different bit of each visit.
 *
 * The box is sized from the string rather than fixed, because "COZY." and
 * "STARS ARE OUT TONIGHT" are not the same width and a box padded for the
 * longest looks empty around the shortest.
 */
function SpeechSign({
  text,
  cx,
  y,
  index,
}: {
  text: string;
  cx: number;
  y: number;
  index: number;
}) {
  // Pixelify Sans at 11px bold advances a shade over 6 units per character.
  const w = Math.round(text.length * 6.1 + 20);
  const x = Math.round(cx - w / 2);
  const tailX = Math.round(w / 2) - 3;

  return (
    <g
      className="scene-say"
      style={{ animationDelay: `${index * 9}s` }}
      transform={`translate(${x} ${y})`}
    >
      <rect x={0} y={0} width={w} height={20} fill="var(--surface)" />
      <rect x={0} y={0} width={w} height={1} fill="var(--fg)" />
      <rect x={0} y={19} width={w} height={1} fill="var(--fg)" />
      <rect x={0} y={0} width={1} height={20} fill="var(--fg)" />
      <rect x={w - 1} y={0} width={1} height={20} fill="var(--fg)" />
      {/* Tail pointing down at the rabbit. */}
      <rect x={tailX} y={20} width={6} height={3} fill="var(--surface)" />
      <rect x={tailX - 1} y={20} width={1} height={3} fill="var(--fg)" />
      <rect x={tailX + 6} y={20} width={1} height={3} fill="var(--fg)" />
      <rect x={tailX} y={23} width={6} height={1} fill="var(--fg)" />
      <text
        x={w / 2}
        y={14}
        textAnchor="middle"
        fill="var(--fg)"
        style={{ font: "700 11px var(--font-display)" }}
      >
        {text}
      </text>
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Day                                                                         */
/* -------------------------------------------------------------------------- */

/** Water surface dashes: [x, y, w]. Two rows, offset, animated apart. */
const SHIMMER_A: ReadonlyArray<readonly [number, number, number]> = [
  [36, 108, 14], [124, 116, 9], [214, 110, 11], [336, 120, 15],
  [428, 108, 10], [520, 114, 13], [596, 110, 8],
];
const SHIMMER_B: ReadonlyArray<readonly [number, number, number]> = [
  [80, 132, 11], [190, 140, 15], [300, 134, 9], [402, 142, 13],
  [498, 130, 12], [578, 138, 10],
];

/** Grass tufts along the bank: [x, height]. */
const TUFTS: ReadonlyArray<readonly [number, number]> = [
  [18, 3], [42, 2], [78, 3], [104, 2], [140, 3], [176, 2], [208, 3],
  [418, 2], [446, 3], [482, 2], [518, 3], [552, 2], [588, 3], [618, 2],
];

/** Posts holding the dock up, dropping into the water. */
const POSTS: readonly number[] = [262, 300, 340, 378];

const RABBIT_X = 292;
const RABBIT_Y = DOCK_TOP - RABBIT_H;
/** The forward paw, where the rod pivots. */
const PAW: readonly [number, number] = [RABBIT_X + 18, RABBIT_Y + 18];

const DAY_LINES = [
  "CAUGHT A FISH!",
  "A BIG ONE!",
  "THAT'S THREE!",
  "ONE MORE CAST...",
] as const;

function DayScene() {
  return (
    <g className="scene-day">
      {/*
        The sky is `--canvas`, the same colour as the page behind it, so the
        scene has no top edge — the treeline appears to grow out of the page
        rather than sitting in a band pasted onto it. Painting the sky cream and
        the clouds mint (the obvious way round, and how this was first written)
        draws a hard horizontal seam across the full width.
      */}
      <rect x={0} y={0} width={WIDTH} height={HORIZON} fill="var(--canvas)" />
      {CLOUDS.map(([x, y, w, h]) => (
        <rect key={`c${x}-${y}`} x={x} y={y} width={w} height={h} fill="var(--sky)" />
      ))}

      <Treeline back="var(--foliage)" front="var(--foliage-dark)" />

      {/* Bank, with tufts breaking up what is otherwise a ruled line. */}
      {TUFTS.map(([x, h]) => (
        <rect key={`t${x}`} x={x} y={BANK_TOP - h} width={2} height={h} fill="var(--foliage)" />
      ))}
      <rect x={0} y={BANK_TOP} width={WIDTH} height={4} fill="var(--foliage)" />
      <rect x={0} y={BANK_TOP + 4} width={WIDTH} height={4} fill="var(--foliage-dark)" />

      <rect x={0} y={HORIZON} width={WIDTH} height={HEIGHT - HORIZON} fill="var(--water)" />
      <rect x={0} y={128} width={WIDTH} height={HEIGHT - 128} fill="var(--water-deep)" />

      <g className="scene-shimmer-a">
        {SHIMMER_A.map(([x, y, w]) => (
          <rect key={`sa${x}`} x={x} y={y} width={w} height={1} fill="var(--sky)" opacity={0.5} />
        ))}
      </g>
      <g className="scene-shimmer-b">
        {SHIMMER_B.map(([x, y, w]) => (
          <rect key={`sb${x}`} x={x} y={y} width={w} height={1} fill="var(--sky)" opacity={0.35} />
        ))}
      </g>

      {/* Dock, after the water so the posts stand in it rather than behind it. */}
      {POSTS.map((x) => (
        <rect key={`p${x}`} x={x} y={DOCK_TOP} width={3} height={18} fill="var(--bark)" opacity={0.85} />
      ))}
      <rect x={252} y={DOCK_TOP} width={136} height={4} fill="var(--bark)" />
      {[266, 286, 306, 326, 346, 366].map((x) => (
        <rect key={x} x={x} y={DOCK_TOP} width={1} height={4} fill="var(--foliage-dark)" />
      ))}

      <Rabbit x={RABBIT_X} y={RABBIT_Y} />

      {/*
        Rod, line and float share one group so the whole rig pivots at the paw.
        The float keeps its own transform on top of that, because it has to bob
        while the rod is still.
      */}
      <g transform={`translate(${PAW[0]} ${PAW[1]})`}>
        <g className="scene-rod">
          <line x1={0} y1={0} x2={50} y2={-30} stroke="var(--bark)" strokeWidth={2} />
          <line x1={50} y1={-30} x2={50} y2={16} stroke="var(--fg)" strokeWidth={0.75} opacity={0.55} />
          <g className="scene-float">
            <rect x={49} y={14} width={3} height={3} fill="var(--accent)" />
            <rect x={49} y={17} width={3} height={1} fill="var(--surface)" />
          </g>
          <g className="scene-fish">
            <rect x={46} y={12} width={5} height={3} fill="var(--series-5)" />
            <rect x={51} y={11} width={2} height={5} fill="var(--series-5)" />
            <rect x={47} y={13} width={1} height={1} fill="var(--fg)" />
          </g>
        </g>
      </g>

      {DAY_LINES.map((line, i) => (
        <SpeechSign key={line} text={line} cx={RABBIT_X + 18} y={42} index={i} />
      ))}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Night                                                                       */
/* -------------------------------------------------------------------------- */

/** [x, y, size]. Kept above the treeline and clear of the sign. */
const STARS: ReadonlyArray<readonly [number, number, number]> = [
  [28, 34, 1], [52, 52, 1], [74, 28, 2], [96, 44, 1], [118, 60, 1],
  [142, 32, 1], [168, 48, 2], [196, 26, 1], [214, 58, 1], [232, 38, 1],
  [408, 30, 1], [426, 54, 1], [448, 40, 2], [472, 24, 1], [494, 50, 1],
  [516, 62, 1], [566, 56, 1], [590, 34, 2], [612, 48, 1], [628, 26, 1],
];

/** The moon, as [dx, width] runs on a 2-unit grid. */
const MOON: ReadonlyArray<readonly [number, number]> = [
  [4, 8], [2, 12], [0, 16], [0, 16], [2, 12], [4, 8],
];

const CAMP_RABBIT_X = 312;
const CAMP_RABBIT_Y = CAMP_GROUND - RABBIT_H;
const FIRE_X = 378;

const NIGHT_LINES = [
  "TOASTY.",
  "MARSHMALLOWS!",
  "STARS ARE OUT",
  "ONE MORE LOG",
] as const;

function NightScene() {
  return (
    <g className="scene-night">
      <rect x={0} y={0} width={WIDTH} height={HORIZON} fill="var(--canvas)" />

      {STARS.map(([x, y, s]) => (
        <rect key={`st${x}-${y}`} x={x} y={y} width={s} height={s} fill="var(--star)" opacity={0.85} />
      ))}

      <g transform="translate(536 28)">
        {MOON.map(([dx, w], i) => (
          <rect key={i} x={dx} y={i * 2} width={w} height={2} fill="var(--moon)" />
        ))}
      </g>

      {/* Silhouettes. The back row is the lighter of the two here as well, but
          both are far darker than in daylight — at night a treeline is a shape,
          not a texture. */}
      <Treeline back="var(--foliage-night)" front="var(--ground-far)" />

      {TUFTS.map(([x, h]) => (
        <rect key={`t${x}`} x={x} y={BANK_TOP - h} width={2} height={h} fill="var(--foliage-night)" />
      ))}
      <rect x={0} y={BANK_TOP} width={WIDTH} height={8} fill="var(--ground-far)" />
      <rect x={0} y={HORIZON} width={WIDTH} height={HEIGHT - HORIZON} fill="var(--ground)" />

      {/*
        Firelight on the ground.

        Thin centred lines, not filled blocks. The first version stacked three
        wide low-opacity rectangles to fake a radial falloff, and at these
        opacities a rectangle over flat ground reads as exactly what it is — a
        visible brown box sat around the fire, with three hard vertical edges
        where the layers stepped. Single-unit lines have no edges to notice, and
        their narrowing widths carry the falloff on their own.
      */}
      <g className="scene-glow">
        {(
          [
            [2, 40, 0.22],
            [4, 74, 0.16],
            [7, 96, 0.12],
            [10, 80, 0.1],
            [14, 58, 0.08],
            [19, 34, 0.06],
          ] as ReadonlyArray<readonly [number, number, number]>
        ).map(([dy, w, o]) => (
          <rect
            key={dy}
            x={FIRE_X - w / 2}
            y={CAMP_GROUND + dy}
            width={w}
            height={1}
            fill="var(--flame)"
            opacity={o}
          />
        ))}
      </g>

      {/* Log seat. */}
      <rect x={300} y={CAMP_GROUND - 2} width={38} height={4} fill="var(--bark)" />
      <rect x={300} y={CAMP_GROUND + 2} width={38} height={1} fill="var(--ember)" opacity={0.4} />

      <Rabbit x={CAMP_RABBIT_X} y={CAMP_RABBIT_Y} />

      {/* Fire: stones, crossed logs, then three flame layers. */}
      <g>
        {[-22, -14, 14, 22].map((dx) => (
          <rect key={dx} x={FIRE_X + dx} y={CAMP_GROUND} width={6} height={3} fill="var(--ground-far)" />
        ))}
        <rect x={FIRE_X - 18} y={CAMP_GROUND - 3} width={36} height={4} fill="var(--bark)" />
        <rect x={FIRE_X - 12} y={CAMP_GROUND - 6} width={24} height={3} fill="var(--ember)" />

        <g className="scene-flame scene-flame-1">
          <rect x={FIRE_X - 10} y={CAMP_GROUND - 14} width={20} height={8} fill="var(--flame)" />
          <rect x={FIRE_X - 7} y={CAMP_GROUND - 20} width={14} height={6} fill="var(--flame)" />
          <rect x={FIRE_X - 4} y={CAMP_GROUND - 25} width={8} height={5} fill="var(--flame)" />
          <rect x={FIRE_X - 2} y={CAMP_GROUND - 28} width={4} height={3} fill="var(--flame)" />
        </g>
        <g className="scene-flame scene-flame-2">
          <rect x={FIRE_X - 6} y={CAMP_GROUND - 13} width={12} height={7} fill="var(--flame-core)" />
          <rect x={FIRE_X - 4} y={CAMP_GROUND - 18} width={8} height={5} fill="var(--flame-core)" />
          <rect x={FIRE_X - 2} y={CAMP_GROUND - 21} width={4} height={3} fill="var(--flame-core)" />
        </g>
        <g className="scene-flame scene-flame-3">
          <rect x={FIRE_X - 3} y={CAMP_GROUND - 11} width={6} height={5} fill="var(--star)" />
        </g>

        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            className="scene-spark"
            style={{ animationDelay: `${i * 0.8}s` }}
            x={FIRE_X - 4 + i * 4}
            y={CAMP_GROUND - 26}
            width={1}
            height={1}
            fill="var(--flame-core)"
          />
        ))}
      </g>

      {NIGHT_LINES.map((line, i) => (
        <SpeechSign key={line} text={line} cx={CAMP_RABBIT_X + 8} y={44} index={i} />
      ))}
    </g>
  );
}

export function PixelScene({ className }: { className?: string }) {
  const [animate, setAnimate] = useState(false);

  // After mount, never during. See the Speed Index note at the top.
  useEffect(() => setAnimate(true), []);

  return (
    <svg
      /*
        Cropped at the top by the viewBox itself rather than by the renderer:
        the sky above y=20 is empty, and carrying it would make the element
        260px taller for nothing — enough to push the rabbit below the fold on a
        laptop, which is the one thing the scene exists to show.
      */
      viewBox={`0 20 ${WIDTH} ${HEIGHT - 20}`}
      /*
        `meet`, not `slice`. The scene must never crop: the rabbit is the point
        of it, and there is no anchor that keeps a 4:1 crop of a 2:1 box from
        cutting either the treeline or the waterline off. The element is sized
        `w-full h-auto` so its height follows its width and the aspect holds.
      */
      preserveAspectRatio="xMidYMax meet"
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      data-animate={animate ? "true" : undefined}
      className={className}
    >
      <DayScene />
      <NightScene />
    </svg>
  );
}
