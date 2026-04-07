import { createLucideIcon } from "lucide-react";

/** Save glyph centered inside a circle (Lucide has no built-in SaveCircle; mirrors CirclePlay-style icons). */
const inner = "translate(12 12) scale(0.62) translate(-12 -12)";

export const SaveCircle = createLucideIcon("SaveCircle", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "0" }],
  [
    "path",
    {
      d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      transform: inner,
      key: "1",
    },
  ],
  [
    "path",
    {
      d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",
      transform: inner,
      key: "2",
    },
  ],
  [
    "path",
    {
      d: "M7 3v4a1 1 0 0 0 1 1h7",
      transform: inner,
      key: "3",
    },
  ],
]);
