import { Box } from "@mui/material";

const InfoBox = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        margin: 1,
        borderRadius: "1rem",
        paddingRight: "0.5rem",
        paddingLeft: "0.5rem",
        // border: "1px solid",
        borderColor: "primary.main",
      }}
    >
      {children}
    </Box>
  );
};

export default InfoBox;
