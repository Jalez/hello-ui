import { Box, Button, IconButton, Input, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { Delete, Edit } from "@mui/icons-material";
import { useState } from "react";
import DoneIcon from "@mui/icons-material/Done";
import { updateGuideSectionTitle } from "../../store/slices/levels.slice";
const InfoGuideSectionTitle = ({
  title,
  sectionLocation,
}: {
  title: string;
  sectionLocation: number;
}) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const dispatch = useAppDispatch();
  const [listTitle, setListTitle] = useState(title);
  const [edited, setEdited] = useState(false);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [showEditDelete, setShowEditDelete] = useState(false);

  const handleClickToEdit = () => {
    setEdited(true);

    // dispatch a select action which makes it editable
  };

  const handleFinishEdit = () => {
    setEdited(false);
    // dispatch a save action
    dispatch(
      updateGuideSectionTitle({
        levelId: currentLevel,
        sectionIndex: sectionLocation,
        text: listTitle,
      })
    );
  };
  // If user is a creator, return a list item that is clickable to edit, and has a delete button to remove it. Use material ui components and icons
  if (isCreator)
    return (
      <Box
        component="li"
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {edited ? (
          <>
            <Input
              sx={{
                color: "primary.main",
                bgcolor: "secondary.main",
                fontSize: "1.5rem",
              }}
              multiline
              maxRows={3}
              value={listTitle}
              onChange={(e) => setListTitle(e.target.value)}
              onBlur={handleFinishEdit}
              autoFocus
            />

            <IconButton color="primary" onClick={handleFinishEdit}>
              <DoneIcon />
            </IconButton>
          </>
        ) : (
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            //When user hovers over the list item, display the edit and delete buttons
            onMouseEnter={() => setShowEditDelete(true)}
            onMouseLeave={() => setShowEditDelete(false)}
          >
            <Typography
              //make this a h2 element
              variant="h2"
            >
              {listTitle}
            </Typography>
            <>
              <IconButton
                color="primary"
                onClick={handleClickToEdit}
                sx={{
                  //Keep in the dom but hide from view if not hovered
                  visibility: showEditDelete ? "visible" : "hidden",
                }}
              >
                <Edit />
              </IconButton>
            </>
          </Box>
        )}
      </Box>
    );

  return (
    <Typography
      //make this a h2 element
      variant="h2"
    >
      {listTitle}
    </Typography>
  );
};

export default InfoGuideSectionTitle;
