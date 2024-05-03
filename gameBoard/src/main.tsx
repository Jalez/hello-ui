import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { store } from "./store/store";
// import {
//   ThemeProvider,
//   createMuiTheme,
//   makeStyles,
//   createTheme,
// } from "@material-ui/core/styles";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { mainColor, secondaryColor } from "./constants";
import { useAppSelector } from "./store/hooks/hooks";

const ThemedApp = () => {
  const options = useAppSelector((state) => state.options);
  const { darkMode } = options;

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: {
            main: darkMode ? mainColor : secondaryColor,
          },
          secondary: {
            main: darkMode ? secondaryColor : mainColor,
          },
        },
        typography: {
          h1: {
            fontFamily: "Kontakt",
            fontSize: 40,
          },
          h2: {
            fontFamily: "Kontakt",
            fontSize: 20,
          },
          h3: {
            fontSize: 20,
            fontFamily: "Kontakt",
            margin: 10,
          },
          button: {
            fontFamily: "Kontakt",
          },
        },
      }),
    [darkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  );
}
