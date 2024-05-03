import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Box, Tab, Tabs, Typography, useTheme } from "@mui/material";

import { styled } from "@mui/system";

type StyledBoxProps = {
  theme: any;
  width: number;
};

const StyledBox = styled("div")<StyledBoxProps>(
  ({ theme, width }) => `
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: ${width}px;
  background-color: ${theme.palette.primary.main};
  box-sizing: border-box;
  border: 2px solid #000;
  color: ${theme.palette.secondary.main};
  box-shadow: 24px;
  padding: 4px;
`
);

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ padding: 3 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

type HelpContentProps = {
  height: number;
};

export const HelpContent = ({ height }: HelpContentProps): JSX.Element => {
  const [value, setValue] = useState(0);
  const { currentLevel } = useSelector((state: any) => state.currentLevel);
  const levelDetails = useSelector(
    (state: any) => state.levels[currentLevel - 1]
  );
  const { description } = levelDetails.help;
  const theme = useTheme();

  const titlesAndDescriptions = [
    {
      title: "General",
      description: "As a CSS artist...",
      // Add the rest of the description
    },
    {
      title: "This level",
      description: description,
    },
  ];

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <StyledBox
      theme={theme}
      width={height}
      id="help-modal"
      aria-labelledby="help-modal-title"
      aria-describedby="help-modal-description"
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="basic tabs example"
        >
          {titlesAndDescriptions.map((titleAndDescription, index) => (
            <Tab
              label={titleAndDescription.title}
              {...a11yProps(index)}
              key={index}
            />
          ))}
        </Tabs>
      </Box>
      {titlesAndDescriptions.map((titleAndDescription, index) => (
        <TabPanel value={value} index={index} key={index}>
          <Typography id="help-modal-title" variant="h6" component="h3">
            {titleAndDescription.title}
          </Typography>
          <Typography id="help-modal-description" sx={{ mt: 2 }}>
            {titleAndDescription.description}
          </Typography>
        </TabPanel>
      ))}
    </StyledBox>
  );
};
