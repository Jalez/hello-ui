/** @format */

import { ReactElement, useEffect, useRef, useState } from 'react';
import { domToPng } from 'modern-screenshot';

const sheet = new CSSStyleSheet();

function App() {
	const boardRef = useRef<HTMLDivElement>(null);
	const [html, setHtml] = useState<ReactElement>();
	const [css, setCss] = useState<string>();
	const [appendedCSS, setAppendedCSS] = useState<Boolean>(false);
	const [stylesCorrect, setStylesCorrect] = useState<Boolean>(false);
	const [urlName, setUrlName] = useState<string>();
	useEffect(() => {
		const handlePostMessage = (event: MessageEvent) => {
			// if (event.data === 'reload') {
			// 	window.location.reload();
			// }
			// If it countains new data, update the state
			if (event.data.name) {
				setUrlName(event.data.name);
			}
			if (event.data.html) {
				// turn the string into a ReactNode element and set it as the state of the component
				setHtml(<kbd dangerouslySetInnerHTML={{ __html: event.data.html }} />);
			}
			if (event.data.css) {
				console.log('name', event.data.name);
				console.log('received css', event.data.css);
				// let style = document.querySelector('style');
				// If oldStyle exists, replace its innerHTML with the new css
				// if (style) {
				// 	// style.innerHTML = event.data.css;
				// 	// delete the old style tag
				// 	style.remove();
				// }
				//  else {
				// add the css as a style tag
				// style = document.createElement('style');
				// style.innerHTML = event.data.css;
				// //}
				// document.head.appendChild(style as any);
				setCss(event.data.css);
				setStylesCorrect(false);
			}
		};

		window.addEventListener('message', handlePostMessage);
		// Once the component is mounted, send a message to the parent window
		window.parent.postMessage('mounted', '*');
		return () => {
			console.log('Unmounted App.tsx');
			window.removeEventListener('message', handlePostMessage);
		};
	}, []);

	useEffect(() => {
		console.log('HEAD', document.head);
		console.log('css', css);
		// If there are multiple style tags, delete the old ones
		// document.head.innerHTML = `
		// <meta charset="UTF-8" />
		// <link rel="icon" type="image/svg+xml" href="/vite.svg" />
		// <meta name="viewport" content="width=device-width, initial-scale=1.0" />
		// <title>DRAW-BOARD</title>
		// <link rel="stylesheet" href="./src/App.css">
		// <style>
		// ${css}
		// </style>
		// `;
		const style = document.querySelector('style') as HTMLStyleElement;
		style.innerHTML = css || '';
		// const styles = document.querySelectorAll('style');
		// if (styles.length > 1) {
		// 	styles.forEach((style, index) => {
		// 		if (index > 0) {
		// 			style.remove();
		// 		}
		// 	});
		// Add the new css as a style tag

		// set appendedCSS to true
		// setAppendedCSS(!appendedCSS);
		// }
		// else if (styles.length === 1) {
		// const style = document.createElement('style');
		// style.innerHTML = css || '';
		// document.head.appendChild(style as any);
		setStylesCorrect(true);
		setAppendedCSS(true);
		// Set stylesCorrect to true
		// console.log(styles);
		// }
	}, [stylesCorrect]);

	useEffect(() => {
		const board = document.getElementById('root');
		console.log('stylesCorrect', stylesCorrect);
		if (stylesCorrect && board) {
			domToPng(board).then((dataURL: string) => {
				if (counter > 0) {
					window.parent.postMessage({ dataURL, urlName }, '*');
				}
				counter++;
				// window.parent.postMessage(dataURL, '*');
			});
			// }
		}
	}, [html, stylesCorrect]);

	return <>{html}</>;
}

let counter = 0;

export default App;
