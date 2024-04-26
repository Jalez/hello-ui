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
  answerKey?: string;
  EditorCode: string;
  editorCodeChanger: (newCode: string) => void;
  editorType: string;
  disabled?: boolean;
  newPrompt?: string;
  newSystemPrompt?: string;
  exampleResponse?: string;
  buttonColor?: string;
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
  answerKey = "code",
  buttonColor = "secondary",
  EditorCode,
  editorCodeChanger,
  editorType,
  disabled = false,
  newPrompt,
  newSystemPrompt,
  exampleResponse = "{" + '"code": "/**New and improved code here*/"' + "}",
}: EditorMagicButtonProps) => {
  const currentlevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentlevel - 1]);
  const name = level.name;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [codeChanges, setCodeChanges] = useState<string>("");
  const defaultSystemPromptAddOn = `Return a json with "${answerKey}"-key that contains the new and improved code for the component.`;
  const [systemPrompt, setSystemPrompt] = useState(
    newSystemPrompt ||
      `You are an AI trained to assist in creating web development educational content. Please generate code for a given component in ${editorType}. 
`
  );
  const [prompt, setPrompt] = useState(
    newPrompt ||
      `Improve the following ${editorType} for a component named ${name}:
Improvements based on the following code: 
- IF CSS: make it more responsive, move magic numbers to named variables in root. 
- If HTML: add accessibility attributes, make it more semantic.
- IF JS: make it more efficient, use more modern syntax.

`
  );

  useEffect(() => {
    setPrompt(
      newPrompt ||
        `Improve the following ${editorType} for a component named ${name}:
Improvements based on the following code: 
- IF CSS: make it more responsive, move magic numbers to named variables in root. 
- If HTML: add accessibility attributes, make it more semantic.
- IF JS: make it more efficient, use more modern syntax.

`
    );
  }, [EditorCode, newPrompt]);

  useEffect(() => {
    setSystemPrompt(
      newSystemPrompt ||
        `You are an AI trained to assist in creating web development educational content. Please generate code for a given component in ${editorType}.`
    );
  }, [editorType, newSystemPrompt]);

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
      console.log("Using systemPrompt:", systemPrompt);
      const response = await fetch(`http://localhost:3000/chatGPT`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt:
            systemPrompt +
            defaultSystemPromptAddOn +
            "example response:" +
            "'''" +
            `{
              "${answerKey}": "${exampleResponse}"
            }` +
            "'''",
          prompt: prompt + "code to improve:" + "'''" + EditorCode + "'''",
        }),
      });
      const data = await response.json();

      if (typeof data === "string") {
        console.log("Data is a string");
        const dP = JSON.parse(data);
        console.log("Data:", dP);
        if (typeof dP[answerKey] === "string") {
          setCodeChanges(
            dP[answerKey] || `No ${answerKey}-key in response: ${dP}`
          );
        } else {
          // stringifying the object
          setCodeChanges(
            JSON.stringify(dP[answerKey]) ||
              `No ${answerKey}-key in response: ${dP}`
          );
        }
      }

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
            color={buttonColor as any}
            onClick={fetchResponse}
            disabled={disabled}
          >
            <AutoAwesomeIcon />
          </IconButton>
          <MagicButtonEditor
            color={buttonColor}
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
            style={{ width: "90vw", overflow: "scroll" }}
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
