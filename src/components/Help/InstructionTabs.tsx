/** @format */

import { useTheme } from "@mui/system";
import DynamicTabs from "../General/DynamicTabs/DynamicTabs";
import { tabsContent } from "./InstructionContent";
import { useMemo } from "react";

const InstructionTabs = () => {
  const theme = useTheme();
  const tabsStyle = useMemo(
    () =>
      ({
        padding: 0,
        // maxHeight: 400,
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.secondary.main,
        overflow: "auto",
        boxShadow: "0px 2px 1px rgba(0, 0, 0, 0.25)",
      } as React.CSSProperties),
    [theme.palette.primary.main, theme.palette.secondary.main]
  );
  return <DynamicTabs style={tabsStyle} tabs={tabsContent} />;
};

export default InstructionTabs;
