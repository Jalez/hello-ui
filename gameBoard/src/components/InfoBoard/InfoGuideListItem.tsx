import {
  Box,
  Button,
  IconButton,
  Input,
  TextField,
  Typography,
} from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { Delete, Edit } from "@mui/icons-material";
import { useState } from "react";
import DoneIcon from "@mui/icons-material/Done";
import {
  removeGuideSectionItem,
  updateGuideSectionItem,
} from "../../store/slices/levels.slice";
const InfoGuideListItem = ({
  item,
  itemLocation,
  sectionLocation,
}: {
  item: string;
  itemLocation: number;
  sectionLocation: number;
}) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const dispatch = useAppDispatch();
  const [listItem, setListItem] = useState(item);
  const [edited, setEdited] = useState(false);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [showEditDelete, setShowEditDelete] = useState(false);

  const handleDelete = () => {
    // dispatch a delete action
    dispatch(
      removeGuideSectionItem({
        levelId: currentLevel,
        itemIndex: itemLocation,
        sectionIndex: sectionLocation,
      })
    );
  };

  const handleClickToEdit = () => {
    setEdited(true);

    // dispatch a select action which makes it editable
  };

  const handleFinishEdit = () => {
    setEdited(false);
    // dispatch a save action
    dispatch(
      updateGuideSectionItem({
        levelId: currentLevel,
        itemIndex: itemLocation,
        sectionIndex: sectionLocation,
        text: listItem,
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
            <TextField
              sx={{
                bgcolor: "primary.main",
                color: "primary.main",
              }}
              multiline
              maxRows={3}
              value={listItem}
              onChange={(e) => setListItem(e.target.value)}
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
              sx={{
                cursor: "pointer",
              }}
            >
              {item}
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
              <IconButton
                sx={{
                  visibility: showEditDelete ? "visible" : "hidden",
                }}
                color="error"
                onClick={handleDelete}
              >
                <Delete />
              </IconButton>
            </>
          </Box>
        )}
      </Box>
    );

  return <Typography component="li">{item}</Typography>;
};

export default InfoGuideListItem;
