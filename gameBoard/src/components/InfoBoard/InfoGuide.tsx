import { Box, Button, Divider, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import InfoGuideListItem from "./InfoGuideListItem";
import {
  addGuideSection,
  addGuideSectionItem,
  removeGuideSection,
  setGuideSections,
} from "../../store/slices/levels.slice";
import InfoGuideSectionTitle from "./InfoGuideSectionTitle";
import EditorMagicButton from "../CreatorControls/EditorMagicButton";
type infoSection = {
  title: string;
  content: string[];
};

const InfoGuide = ({ sections }: { sections: infoSection[] }) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);

  const level = levels[currentLevel - 1];
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const handleAddTiret = (sectionIndex: number) => {
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

  // take all the code that is not locked in the level
  let EditorCode = "";
  if (!level) return <div>Loading...</div>;
  if (level.code) {
    if (!level.lockCSS)
      EditorCode +=
        "SOLUTION CSS:" +
        "\n" +
        level.solution.css +
        "\n" +
        "TEMPLATE CSS:" +
        "\n" +
        level.code.css;
    if (!level.lockHTML)
      EditorCode +=
        "SOLUTION HTML:" +
        "\n" +
        level.solution.html +
        "\n" +
        "TEMPLATE HTML:" +
        "\n" +
        level.code.html;
    if (!level.lockJS)
      EditorCode +=
        "SOLUTION JS:" +
        "\n" +
        level.solution.js +
        "\n" +
        "TEMPLATE JS:" +
        "\n" +
        level.code.js;
  }

  const updateSections = (newSections: string) => {
    // parse the newSections string into infoSection[]
    const newSectionsArray = JSON.parse(newSections) as infoSection[];
    // update the level with the new sections
    dispatch(
      setGuideSections({ levelId: currentLevel, sections: newSectionsArray })
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "2em",
        //center the sections
        justifyContent: "start",
        alignItems: "center",
        maxHeight: "200px",
        overflowY: "auto",
      }}
    >
      <Typography variant="h2">Instructions</Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "2em",
          margin: "1em",
          justifyContent: "center",
          alignItems: "start",
        }}
      >
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
                maxWidth: "400px",
                //Add border if creator
                border: isCreator ? "8px dashed black" : "none",
              }}
            >
              <InfoGuideSectionTitle
                title={section.title}
                sectionLocation={index}
              />
              {isCreator && (
                <Button
                  color="error"
                  onClick={() => handleRemoveSection(index)}
                >
                  Remove section
                </Button>
              )}
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
      </Box>
      {isCreator && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "1em",
            padding: "1em",
            borderRadius: "1rem",
            bgcolor: "secondary.main",
            justifyContent: "center",
            alignItems: "center",
            //Add border if creator
          }}
        >
          {sections.length === 0 && <>No instruction sections found.</>}

          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: "1em",
              borderRadius: "1rem",
              bgcolor: "secondary.main",
              //Add border if creator
            }}
          >
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
            <Divider
              // make it vertical
              orientation="vertical"
              sx={{
                height: "200px",
                flexGrow: 1,
                "&::before, &::after": {
                  borderColor: "primary.main",
                  borderTop: "thin solid", // Replace #YourColorCode with your desired color
                },
              }}
            >
              Or
            </Divider>

            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "1em",
                borderRadius: "1rem",
                bgcolor: "secondary.main",
                justifyContent: "center",
                //Add border if creator
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "1em",
                  bgcolor: "secondary.main",
                  justifyContent: "center",
                }}
              >
                <EditorMagicButton
                  buttonColor="primary"
                  EditorCode={EditorCode}
                  editorCodeChanger={updateSections}
                  editorType="sections"
                  exampleResponse={`[
{
  "title": "Task Overview:",
  "content": [
    "In this exercise, you're provided with the HTML structure and CSS styling for a dynamic list. Your task is to write the JavaScript necessary to dynamically populate the list based on data provided in the JavaScript template."
  ]
},
{
  "title": "JavaScript Objectives:",
  "content": [
    "Understand how to select elements in the DOM using JavaScript.",
    "Learn to create new DOM elements and set their properties.",
    "Practice adding these elements to the DOM to build a dynamic list."
  ]
},
{
  "title": "Key Concepts to Explore:",
  "content": [
    "To complete your task, consider exploring the following JavaScript concepts:",
    "Document Object Model (DOM) manipulation methods such as document.querySelector and document.createElement.",
    "Array methods like forEach for iterating over data to create list items."
  ]
},
{
  "title": "Challenge:",
  "content": [
    "As an optional challenge, try the interactivity of your list by using the new 'Slider/Interactive' toggle. This feature will be used in upcoming gage(s)."
  ]
}
]`}
                  newPrompt="Create instructions for the following code. You will be provided both the solution and the template code. The instructions should be vague enough not to give away the solution, but clear enough to guide the user in the right direction. "
                  newSystemPrompt="You are an AI trained to create instructions on how to solve a coding challenge. These instructions need to the vague enough not to give away the solution, but clear enough to guide the user in the right direction. You can add new sections to the instructions by entering them in JSON format. The sections should be an array of objects, each object should have a title and content property. The title should be a string and the content should be an array of strings. For example: [{title: 'Title of the section', content: ['Content']}]. There should at most be 3 sections, and atleast 1 section."
                />
              </Box>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                Generate instructions
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default InfoGuide;
