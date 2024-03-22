// import React, { useState, useEffect, useRef, useCallback } from "react";
// import {
//   Button,
//   Menu,
//   MenuItem,
//   MenuProps,
//   styled,
//   useTheme,
// } from "@mui/material";
// import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
// import { useAppSelector } from "../../store/hooks/hooks";
// import { InfoPicture } from "./InfoPicture";

// const StyledMenu = styled((props: MenuProps) => (
//   <Menu elevation={0} {...props} />
// ))(({ theme }) => ({
//   "& .MuiPaper-root": {
//     boxShadow:
//       "rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
//     "& .MuiMenu-list": {
//       padding: "0",
//     },
//   },
// }));

// const MenuContainer = styled("div")(({ theme }) => ({
//   margin: 0,
//   padding: 0,
//   backgroundColor: theme.palette.secondary.main,
//   maxHeight: 500,
//   width: "100%",
//   display: "flex",
//   flexDirection: "column",
//   pointerEvents: "visible",
//   overflow: "auto",
//   justifyContent: "center",
// }));

// const CloseButtonContainer = styled("div")(({ theme }) => ({
//   backgroundColor: theme.palette.secondary.main,
//   height: 40,
//   display: "flex",
//   justifyContent: "end",
// }));

// const PicturesContainer = styled("div")({
//   display: "flex",
//   flexWrap: "wrap",
//   flexDirection: "row",
//   justifyContent: "center",
//   width: "100%",
//   alignItems: "center",
// });

// const StyledButton = styled(Button)(({ theme }) => ({
//   display: "flex",
//   flexDirection: "row",
//   font: "inherit",
//   color: "inherit",
//   margin: 0,
//   "&:hover": {
//     backgroundColor: "transparent",
//   },
// }));

// export const InfoPictures = () => {
//   const { currentLevel } = useAppSelector((state) => state.currentLevel);
//   const levelDetails = useAppSelector(
//     (state) => state.levels[currentLevel - 1]
//   );
//   const [keepOpen, setKeepOpen] = useState<null | boolean>(false);
//   const buttonRef = useRef<HTMLButtonElement>(null);
//   const [open, setOpen] = useState(false);

//   const pictures = levelDetails?.buildingBlocks?.pictures;
//   if (!pictures || pictures.length === 0) return null;

// const handleClose = useCallback(() => {
//     setOpen(false);
//   }

//   return (
//     <div id="info-pictures" onMouseLeave={() => setOpen(false)}>
//       <StyledButton
//         ref={buttonRef}
//         onMouseEnter={() => setOpen(true)}
//         endIcon={<KeyboardArrowDownIcon />}
//       >
//         Pictures
//       </StyledButton>
//       <StyledMenu
//         anchorEl={buttonRef.current}
//         open={open}
//         onClose={() => setOpen(false)}
//         MenuListProps={{ onMouseOver: () => setKeepOpen(true) }}
//       >
//         <MenuContainer onMouseLeave={handleClose}>
//           <CloseButtonContainer>
//             <Button
//               onClick={() => setOpen(false)}
//               variant="contained"
//               color="primary"
//             >
//               Close
//             </Button>
//           </CloseButtonContainer>
//           <PicturesContainer>
//             {pictures.map((picture, index) => (
//               <InfoPicture key={Math.random() * 100000} picture={picture} />
//             ))}
//           </PicturesContainer>
//         </MenuContainer>
//       </StyledMenu>
//     </div>
//   );
// };
