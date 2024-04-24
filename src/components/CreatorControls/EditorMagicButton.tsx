import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Modal,
  TextareaAutosize,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { color } from "d3";
import { Level } from "../../types";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { addThisLevel } from "../../store/slices/levels.slice";
import { Edit } from "@mui/icons-material";
import MagicButtonEditor from "./MagicButtonEditor";

type EditorMagicButtonProps = {
  EditorCode: string;
  editorCodeChanger: (newCode: string) => void;
  editorType: string;
  disabled?: boolean;
};

// function formatHtmlString(escapedHtml: string) {
//   // Unescape HTML-specific characters and remove unnecessary backslashes
//   let formattedHtml = escapedHtml
//     .replace(/\\n/g, "\n") // Replace escaped newlines with actual newlines
//     .replace(/\\\"/g, '"') // Replace escaped double quotes with actual double quotes
//     .replace(/\\\\/g, "\\"); // Replace double backslashes with a single backslash

//   return formattedHtml;
// }

const EditorMagicButton = ({
  EditorCode,
  editorCodeChanger,
  editorType,
  disabled = false,
}: EditorMagicButtonProps) => {
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
  const [codeChanges, setCodeChanges] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState(
    `You are an AI trained to assist in creating web development educational content. Please generate code for a given component in ${editorType}. Return a json with a code-key that contains the new code for the component.`
  );
  const [prompt, setPrompt] = useState(
    `Improve the following ${editorType} for a component named ${name}:
    
    code: 

    '''
    ${EditorCode}
    '''
    `
  );

  useEffect(() => {
    setPrompt(
      `Improve the following ${editorType} for a component named ${name}:
      
      code: 

      '''
      ${EditorCode}
      '''
      `
    );
  }, [EditorCode]);

  useEffect(() => {
    setSystemPrompt(
      `You are an AI trained to assist in creating web development educational content. Please generate code for a given component in ${editorType}. Return a json with a code-key that contains the new code for the component.`
    );
  }, [editorType]);

  const style = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "fit-content",
    bgcolor: "secondary.main",
    border: "2px solid #000",
    boxShadow: 24,
    color: "primary.main",
    p: 4,
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
        console.log("Data is a string");
        const dP = JSON.parse(data);
        setCodeChanges(dP.code);
      }
      setCodeChanges(data.code);
      //open the modal
      setLoading(false);
      handleOpen();
    } catch (error) {
      setLoading(false);
      console.error("Error:", error);
    }
  };

  const handleApprove = () => {
    editorCodeChanger(codeChanges);
  };

  const handleSystemInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setSystemPrompt(event.target.value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleCodeChanges = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCodeChanges(event.target.value);
  };
  return (
    <>
      {loading && <CircularProgress />}
      {!loading && (
        <>
          <IconButton
            color="secondary"
            onClick={fetchResponse}
            disabled={disabled}
          >
            <AutoAwesomeIcon />
          </IconButton>
          <MagicButtonEditor
            disabled={disabled}
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
      >
        <Box sx={style}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Response from ChatGPT (Can be edited):
          </Typography>
          <TextareaAutosize
            minRows={3}
            style={{ width: "100%" }}
            value={codeChanges}
            onChange={handleCodeChanges}
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

export default EditorMagicButton;
