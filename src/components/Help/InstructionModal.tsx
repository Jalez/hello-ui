/** @format */

import * as React from "react";
import { useEffect } from "react";
import "./InstructionModal.css";

interface InstructionModalProps {
  open: boolean;
  children: any;
}

import { styled, keyframes } from "@mui/system";

// Keyframes for fade-in and fade-out
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

// Styled component with animations
import { MUIStyledCommonProps } from "@mui/system";

interface ModalContainerProps extends MUIStyledCommonProps {
  isVisible: boolean;
}

const ModalContainer = styled("div")<ModalContainerProps>(({ isVisible }) => ({
  position: "absolute",
  display: "flex",
  justifyContent: "center",
  // align it to the top, but give some space to the top
  alignItems: "flex-start",
  // put some space between the children

  width: "100%",
  height: "100%",
  zIndex: 100,
  backdropFilter: "blur(5px)", // Static backdropFilter
  opacity: `${isVisible ? 1 : 0}`,
  animation: `${isVisible ? fadeIn : fadeOut} 1s ease-out`,
}));

const InstructionModal = ({ open, children }: InstructionModalProps) => {
  const [maskClass, setMaskClass] = React.useState("hide-mask");
  const [id, setId] = React.useState("element-to-mask");
  const [closed, setClosed] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (open) {
      setIsVisible(true);
      setMaskClass("show-mask");
      setClosed(false);
      setTimeout(() => {}, 100);
    } else {
      setMaskClass("hide-mask");
      setIsVisible(false);

      timeout = setTimeout(() => {
        setClosed(true);
      }, 1000);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    if (id === "element-to-mask" && open) {
      setTimeout(() => {
        setId("");
      }, 400);
    }
  }, [id, open]);

  console.log("isVisible", isVisible);
  if (closed) return null;
  return (
    <ModalContainer isVisible={isVisible} className="mask-container">
      <section
        id={id}
        className={`element ${maskClass}`}
        style={{
          margin: "10rem",
        }}
      >
        {children}
      </section>
    </ModalContainer>
  );
};

export default InstructionModal;
