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
			// If it countains new data, update the state
			if (event.data.name) {
				setUrlName(event.data.name);
			}
			if (event.data.html) {
				// turn the string into a ReactNode element and set it as the state of the component
				setHtml(<kbd dangerouslySetInnerHTML={{ __html: event.data.html }} />);
			}
			if (event.data.css) {
				setCss(event.data.css);
				setStylesCorrect(false);
			}
		};

		window.addEventListener('message', handlePostMessage);
		// Once the component is mounted, send a message to the parent window
		window.parent.postMessage('mounted', '*');
		return () => {
			window.removeEventListener('message', handlePostMessage);
		};
	}, []);

	useEffect(() => {
		const style = document.querySelector('style') as HTMLStyleElement;
		style.innerHTML = css || '';
		setStylesCorrect(true);
		setAppendedCSS(true);
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
