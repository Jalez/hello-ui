import { createLucideIcon } from "lucide-react";

/** Play-in-circle with a larger triangle than stock PlayCircle (matches SaveCircle-style emphasis). */
const playScale = "translate(12 12) scale(1.32) translate(-12 -12)";

export const AutoRunCircle = createLucideIcon("AutoRunCircle", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "0" }],
  [
    "polygon",
    {
      points: "10 8 16 12 10 16 10 8",
      transform: playScale,
      key: "1",
    },
  ],
]);
