import React, { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Modal,
  Typography,
  TextareaAutosize,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

type MagicButtonEditorProps = {
  prompt: string;
  systemPrompt: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSystemInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  fetchResponse: () => void;
  disabled?: boolean;
  color?: string;
};

const MagicButtonEditor = ({
  prompt,
  systemPrompt,
  handleInputChange,
  handleSystemInputChange,
  fetchResponse,
  disabled = false,
  color = "secondary",
}: MagicButtonEditorProps) => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <IconButton color={color as any} onClick={handleOpen} disabled={disabled}>
        <EditIcon />
      </IconButton>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="edit-prompt-title"
        aria-describedby="edit-prompt-description"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: "80%",

            bgcolor: "secondary.main",
            border: "2px solid #000",
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography id="edit-prompt-title" variant="h2" component="h2">
            Prompts sent to ChatGPT
          </Typography>
          <Typography id="edit-prompt-title" variant="h6" component="h2">
            Edit System Prompt:
          </Typography>
          <Typography
            id="edit-prompt-description"
            variant="body1"
            component="p"
          >
            This is the prompt that will tell the AI how to act, what to do, and
            what to generate. It should be a detailed description of the task
            you want the AI to perform.
          </Typography>
          <TextareaAutosize
            minRows={3}
            style={{ width: "100%" }}
            value={systemPrompt}
            onChange={handleSystemInputChange}
            aria-label="empty textarea"
          />
          <Typography id="edit-prompt-title" variant="h6" component="h2">
            Edit Prompt:
          </Typography>
          <Typography
            id="edit-prompt-description"
            variant="body1"
            component="p"
          >
            This is the prompt that should describe the level you want to
            create. It should be a detailed description of what code the student
            should write to complete the level, and what the final result should
            look like.
          </Typography>

          <TextareaAutosize
            minRows={3}
            style={{ width: "100%" }}
            value={prompt}
            onChange={handleInputChange}
            aria-label="empty textarea"
          />
          <Button onClick={fetchResponse}>Send to ChatGPT</Button>
          <Button onClick={handleClose}>Close</Button>
        </Box>
      </Modal>
    </>
  );
};

export default MagicButtonEditor;
