import { Box, Typography } from "@mui/material";

export const KeyBindings = (): JSX.Element => {
  // lists all the keybindings
  return (
    <Box
      sx={{
        // position: "absolute",
        // give it a greyish background
        // bgcolor: "rgba(0, 0, 0, 0.5)",
        color: "primary.main",
        bgcolor: "secondary.main",
        padding: "1rem",
        zIndex: 10,
      }}
    >
      <Typography variant="h2">Hotkeys</Typography>
      {/* <Typography variant="body1"> */}
      <ul>
        {/* <li>
          <strong>Ctrl + S</strong> - Save and test the code
        </li> */}
        <li>
          <strong>Ctrl + Z</strong> - Undo the last code change
        </li>
        <li>
          <strong>Ctrl + Y</strong> - Redo the last action
        </li>
        <li>
          <strong>Ctrl + C</strong> - Copy the selected text
        </li>
        <li>
          <strong>Ctrl + X</strong> - Cut the selected text
        </li>
        <li>
          <strong>Ctrl + V</strong> - Paste the copied text
        </li>
        <li>
          <strong>Ctrl + '</strong> - Comment/Uncomment the selected line
        </li>
        <li>
          <strong>Ctrl + L</strong> - Highlight the current line
        </li>
      </ul>
      {/* </Typography> */}
    </Box>
  );
};
