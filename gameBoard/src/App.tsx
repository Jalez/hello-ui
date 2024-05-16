/** @format */

import "./App.css";

import { Editors } from "./components/Editors/Editors";
import { ArtBoards } from "./components/ArtBoards/ArtBoards";
import Instruction from "./components/Help/Instruction";
import { LevelUpdater } from "./LevelUpdater";
import { GameContainer } from "./GameContainer";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import InfoInstructions from "./components/InfoBoard/InfoInstructions";
import { CSSWordCloud } from "./components/CSSWordCloud/CSSWordCloud";
import { useEffect } from "react";
import { updateWeek } from "./store/slices/levels.slice";
import { sendScoreToParentFrame } from "./store/actions/score.actions";
import { Footer } from "./components/Footer/Footer";
import { Navbar } from "./components/Navbar/Navbar";
import { setCreator } from "./store/slices/options.slice";
import { Level } from "./types";
// import { getMapLevelsData } from "./utils/network/levels";
import Info from "./components/InfoBoard/Info";
import {
  SolutionMap,
  availableWeeks,
  createLevels,
  week,
} from "./utils/LevelCreator";
import Notifications from "./components/General/Notifications";
import { SnackbarProvider } from "notistack";
import { setSolutions } from "./store/slices/solutions.slice";
import { getAllLevels } from "./utils/network/levels";
import { getMapLevels } from "./utils/network/maps";
import { initializePoints } from "./store/slices/points.slice";
import { Box } from "@mui/material";
import NewEditors from "./components/Editors/EditorsNew";

const AppStyle = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  alignItems: "center",
  position: "relative" as const,
  width: "100%",
  height: "100%",
  // disable scrolling
  // overflow: "hidden",
  boxSizing: "border-box" as const,
};

export let allLevels: Level[] = [];

function App() {
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  useEffect(() => {
    // once it's mounted, send a message to the parent window
    //Example url: http://localhost:5173/creator?week=test
    // look at the url params to determine the week
    const isCreator = window.location.pathname.includes("creator");

    const urlParams = new URLSearchParams(window.location.search);
    const map = urlParams.get("map") || "all";
    let mapName = map as week;
    let solutions: SolutionMap = {};

    if (availableWeeks.includes(map)) {
      console.log();
      const levelsObj = createLevels(map as week);
      const levels = levelsObj?.levels || [];
      allLevels = levels;
      solutions = levelsObj?.solutions || {};
      if (isCreator) {
        allLevels = allLevels.map((level) => {
          level.solution = {
            html: solutions[level.name]?.html || "",
            css: solutions[level.name]?.css || "",
            js: solutions[level.name]?.js || "",
          };
          return level as Level;
        });
      }
      dispatch(updateWeek({ levels: allLevels, mapName }));
      dispatch(initializePoints(allLevels));
      dispatch(setSolutions(solutions));
    } else {
      const fetchLevels = async (mapName: string) => {
        if (mapName === "all") {
          allLevels = await getAllLevels();
        } else {
          allLevels = await getMapLevels(mapName);
        }
        if (!isCreator) {
          // allLevels = allLevels.map((level) => {
          //   level.solution = { html: "", css: "", js: "" };
          //   return level as Level;
          // });
        }
        solutions = allLevels.reduce((acc, level) => {
          acc[level.name] = {
            html: level.solution.html,
            css: level.solution.css,
            js: level.solution.js,
          };
          return acc;
        }, {} as SolutionMap);

        if (isCreator) {
          allLevels = allLevels.map((level) => {
            level.solution = {
              html: solutions[level.name]?.html || "",
              css: solutions[level.name]?.css || "",
              js: solutions[level.name]?.js || "",
            };
            return level as Level;
          });
        }
        console.log("solutions", solutions);
        dispatch(updateWeek({ levels: allLevels, mapName }));
        dispatch(initializePoints(allLevels));
        dispatch(setSolutions(solutions));
      };
      fetchLevels(map || "all");
    }

    // also check whether or not we are in the creator
    dispatch(setCreator(isCreator));

    dispatch(sendScoreToParentFrame());
  }, []);

  return (
    <SnackbarProvider>
      {!isCreator && <Instruction />}
      <article id="App" style={AppStyle}>
        <LevelUpdater />
        <Notifications />

        <GameContainer>
          {levels.length > 0 && (
            <>
              {/* <LevelOpinion /> */}

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  width: "100%",
                }}
              >
                <Box>
                  <Navbar />
                  <InfoInstructions>
                    <Info />
                  </InfoInstructions>
                  {options.showWordCloud && <CSSWordCloud />}
                  <ArtBoards />
                </Box>
                {/* <Editors />
                 */}
                <NewEditors />
              </Box>
            </>
          )}
          <Footer />
        </GameContainer>
      </article>
    </SnackbarProvider>
  );
}

export default App;
