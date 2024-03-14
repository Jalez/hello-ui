import React, { useState, useEffect, ReactNode } from "react";
import { styled, keyframes } from "@mui/system";
import { useAppSelector } from "../../../store/hooks/hooks";
import { Level } from "../../../types";

type ShakerBaseProps = {
  children: ReactNode;
  shouldAnimate: boolean;
};

const shakeAnimation = keyframes`
        0% { top: 0px; }
        50% { transform: rotate(5deg); }
        80% { transform: rotate(-5deg); }
        100% { top: 5px; }
`;

const ShakerBase = styled("span")(({ shouldAnimate }: ShakerBaseProps) => ({
  position: "relative",
  animation: shouldAnimate
    ? `${shakeAnimation} 250ms alternate infinite`
    : "none",
  // because its a span, make it not inline
  display: "inline-block",
}));

type ShakerProps = {
  children: ReactNode;
  value: string | number;
};

const Shaker = ({ children, value }: ShakerProps) => {
  const [prevValue, setPrevValue] = useState<string | number>(value);
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    if (value !== prevValue) {
      setShouldAnimate(true);
      setTimeout(() => {
        setPrevValue(value);
      }, 1000);
    } else {
      setShouldAnimate(false);
    }
  }, [value, prevValue]);

  return <ShakerBase shouldAnimate={shouldAnimate}>{children}</ShakerBase>;
};

export default Shaker;
