import { Box, Button, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import InfoGuideListItem from "./InfoGuideListItem";
import {
  addGuideSection,
  addGuideSectionItem,
  removeGuideSection,
} from "../../store/slices/levels.slice";
import InfoGuideSectionTitle from "./InfoGuideSectionTitle";
type infoSection = {
  title: string;
  content: string[];
};

const InfoGuide = ({ sections }: { sections: infoSection[] }) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const handleAddTiret = (sectionIndex: number) => {
    console.log("Add tiret");
    dispatch(
      addGuideSectionItem({
        levelId: currentLevel,
        sectionIndex,
        text: "New tiret, click to edit",
      })
    );
  };

  const handleAddSection = () => {
    dispatch(
      addGuideSection({
        levelId: currentLevel,
        title: "New title, click to edit",
        content: ["New content, click to edit"],
      })
    );
  };

  const handleRemoveSection = (sectionIndex: number) => {
    dispatch(removeGuideSection({ levelId: currentLevel, sectionIndex }));
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        gap: "2em",
        //center the sections
        justifyContent: "center",
        alignItems: "start",
      }}
    >
      {sections.length === 0 && <>No instruction sections found.</>}
      {sections.length > 0 &&
        sections.map((section, index) => (
          <Box
            key={index}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: "1em",
              padding: "1em",
              borderRadius: "1rem",
              bgcolor: "secondary.main",
              //Add border if creator
              border: isCreator ? "8px dashed black" : "none",
            }}
          >
            <InfoGuideSectionTitle
              title={section.title}
              sectionLocation={index}
            />
            <Button color="error" onClick={() => handleRemoveSection(index)}>
              Remove section
            </Button>
            <Typography component="ul">
              {section.content.map((item, idx) => (
                <InfoGuideListItem
                  key={idx}
                  item={item}
                  itemLocation={idx}
                  sectionLocation={index}
                />
              ))}
            </Typography>
            {isCreator && (
              <Button onClick={() => handleAddTiret(index)}>Add tiret</Button>
            )}
          </Box>
        ))}
      <Button
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "200px",
          margin: "1em",
        }}
        onClick={handleAddSection}
      >
        <PlaylistAddIcon
          sx={{
            fontSize: "5rem",
          }}
        />
        Add new title/content section
      </Button>
    </Box>
  );
};

export default InfoGuide;
