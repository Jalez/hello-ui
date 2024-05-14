import { Box, Slide, Tab, Tabs } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useAppSelector } from "../../store/hooks/hooks";

type ArtTabsProps = {
  tabNames: string[];
  tabContents: JSX.Element[];
};

type slideInDirection = "left" | "right";

const ArtTabs = ({ tabNames, tabContents }: ArtTabsProps): JSX.Element => {
  const [value, setValue] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideIn, setSlideIn] = useState(true);
  const [direction, setDirection] = useState<slideInDirection>("left"); // Manage slide direction
  const currentLevel = useAppSelector((state: any) => state.currentLevel);
  const level = useAppSelector((state: any) => state.levels[currentLevel - 1]);
  const solutions = useAppSelector((state: any) => state.solutions);
  // take the drawn-state of the current level from the solutions
  if (!level) return <Box>Level not found</Box>;
  const drawnState = solutions[level.name].drawn;
  const containerRef = useRef(null);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    const newDirection = newValue > activeIndex ? "left" : "right";
    setDirection(newDirection); // Set slide-out direction based on tab index comparison
    setSlideIn(false); // Start slide-out effect
    setTimeout(() => {
      setActiveIndex(newValue); // Change content after slide-out
      setSlideIn(true); // Start slide-in effect
      setDirection(newValue > activeIndex ? "right" : "left"); // Set slide-in direction for next
    }, 300); // Time for the slide-out effect
  };

  useEffect(() => {
    setValue(activeIndex);
  }, [activeIndex]);

  return (
    <Box
      ref={containerRef}
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="wrapped label tabs example"
      >
        {tabNames.map((tabName: string, index: number) => (
          <Tab
            key={index}
            label={tabName}
            value={index}
            // if tab is not selected, set the color to primary but opacity to 0.5
            sx={{
              color: value === index ? "primary.main" : "primary.main",
              opacity: value === index ? 1 : 0.5,
            }}
          />
        ))}
      </Tabs>
      {drawnState && <Box>Is drawn</Box>}
      {tabContents.map(
        (tabContent: JSX.Element, index: number) =>
          value === index && (
            <Slide
              in={slideIn}
              container={containerRef.current}
              key={index}
              direction={direction} // Use dynamic direction based on state
            >
              <Box>{tabContent}</Box>
            </Slide>
          )
      )}
    </Box>
  );
};

export default ArtTabs;
