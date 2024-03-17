/** @format */

import { useTheme } from "@mui/system";
import DynamicTabs from "../General/DynamicTabs/DynamicTabs";
import { tabsContent } from "./InstructionContent";

const InstructionTabs = () => {
  const theme = useTheme();
  const tabsStyle = {
    padding: 0,
    // maxHeight: 400,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.secondary.main,
    overflow: "auto",
    boxShadow: "0px 2px 1px rgba(0, 0, 0, 0.25)",
  };
  return (
    <div style={{ padding: 30 }}>
      <DynamicTabs style={tabsStyle} tabs={tabsContent} />
    </div>
  );
};

export default InstructionTabs;
