import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Modal,
  TextareaAutosize,
  Typography,
} from "@mui/material";
import { useState } from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { color } from "d3";
import { Level } from "../../types";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { addThisLevel } from "../../store/slices/levels.slice";
import { Edit } from "@mui/icons-material";
import MagicButtonEditor from "./MagicButtonEditor";

const MagicButton = () => {
  const dispatch = useAppDispatch();
  const currentlevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentlevel - 1]);
  const name = level.name;
  const [open, setOpen] = useState(false);
  const [openEditor, setOpenEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [newLevel, setNewLevel] = useState<string>("");
  const [systemPrompt, setSystemPrompt] =
    useState(`You are an AI trained to assist in creating web development educational content. Please generate a detailed web development lesson for a given component. The lesson should be structured in JSON format with the following keys:

- "name": The title of the lesson, indicative of the web component to be developed.
- "code": Contains the template html/js/css for the students. The HTML should be simple and include placeholder elements where students will add what elements are needed to accomplish the creation of desired element. The CSS should include all units and colors, offering them through CSS variables in :root for easy access to student. 
- "solution": Provide the fully developed HTML, CSS, and JavaScript that represent the final and correct implementation of the component. Ensure the HTML uses semantic tags, the CSS employs advanced styling techniques such as flexbox or grid, and the JavaScript effectively enhances the component's functionality.

The response should be directly in JSON format suitable for immediate integration into the web development teaching platform. Always return it in the format as shown in the following example: 

{
  "name": "${name}",
  "code": {
    "html": "<!-- Template HTML for students goes here -->",
    "css": "/* Template CSS for students goes here */",
    "js": "// Starting code for the students DOM manipulation goes here "
  },
  "solution": {
    "html": "<!-- Here is the complete HTML -->",
    "css": "/* Here are the complete styles, including layout and responsiveness */",
    "js": "// Here's all the JavaScript for interactivity and functionality that was needed to complete the component" 
     */"
  }
}`);
  const [prompt, setPrompt] = useState(
    `Create a level for a component named ${name}. `
  );

  const style = {
    bgcolor: "secondary.main",
    border: "2px solid #000",
    boxShadow: 24,
    color: "primary.main",
    p: 4,
    width: "80%",
  };

  const fetchResponse = async () => {
    //Use our API to get a response from chatGPT, use the name of the level in the prompt
    try {
      handleClose();
      setLoading(true);
      const response = await fetch(`http://localhost:3000/chatGPT`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ systemPrompt, prompt }),
      });
      const data = await response.json();
      console.log("Data:", data);
      if (typeof data === "string") {
        console.log("Data already string");
        setNewLevel(data);
      } else {
        console.log("Data is not string");
        setNewLevel(JSON.stringify(data));
      }
      //open the modal
      setLoading(false);
      handleOpen();
    } catch (error) {
      setLoading(false);
      console.error("Error:", error);
    }
  };

  const handleApprove = () => {
    dispatch(addThisLevel(newLevel));
  };

  const formatNewLevel = (newLevel: any) => {
    //Format it so that it can be shown in the modal
    return JSON.stringify(newLevel, null, 2);
  };

  const handleSystemInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setSystemPrompt(event.target.value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleLevelEdit = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewLevel(event.target.value);
  };
  return (
    <>
      {loading && (
        <Box sx={{ display: "flex" }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && (
        <>
          <IconButton color="primary" onClick={fetchResponse}>
            <AutoAwesomeIcon />
          </IconButton>
          <MagicButtonEditor
            prompt={prompt}
            systemPrompt={systemPrompt}
            handleInputChange={handleInputChange}
            handleSystemInputChange={handleSystemInputChange}
            fetchResponse={fetchResponse}
          />
        </>
      )}
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box sx={style}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Response from ChatGPT:
          </Typography>
          <TextareaAutosize
            minRows={3}
            style={{ width: "100%" }}
            value={newLevel}
            onChange={handleLevelEdit}
            aria-label="empty textarea"
          />
          <Button
            onClick={() => {
              handleApprove();
              handleClose();
            }}
          >
            Approve
          </Button>
          <Button
            onClick={() => {
              console.log("Rejecting");
              handleClose();
            }}
          >
            Reject
          </Button>
        </Box>
      </Modal>
    </>
  );
};

export default MagicButton;
