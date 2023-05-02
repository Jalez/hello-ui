/** @format */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { store } from './store/store';

import { createTheme, ThemeProvider } from '@mui/material/styles';
// Set textShadow: "5px 0px 0px #D4AF37" for h2 and h3 tags in the theme if color is primary, and for h2 and h3 tags in the theme if color is secondary
const theme = createTheme({
	typography: {
		h1: {
			fontFamily: 'Kontakt',
			fontSize: 75,
			color: '#D4AF37',

			textShadow: '10px 0px 0px #222',
		},
		h2: {
			fontFamily: 'Kontakt',

			fontSize: 50,
			color: '#D4AF37',
			textShadow: '5px 0px 0px #222',
			// Add underline
		},
		h3: {
			fontSize: 20,
			fontFamily: 'Kontakt',
			margin: 10,
		},
		button: {
			fontFamily: 'Kontakt',
		},
		// Add font family kontakt for switch and form control label, but not for paragraph
		body1: {
			fontFamily: 'Kontakt',
		},
	},
	palette: {
		primary: {
			main: '#D4AF37',
		},

		secondary: {
			main: '#222',
		},
	},
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<Provider store={store}>
		<ThemeProvider theme={theme}>
			<App />
		</ThemeProvider>
	</Provider>
);
