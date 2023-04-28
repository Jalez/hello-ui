/** @format */

import { ReactElement, useEffect, useRef, useState } from 'react';
import { domToPng } from 'modern-screenshot';

const sheet = new CSSStyleSheet();

function App() {
	const boardRef = useRef<HTMLDivElement>(null);
	const [html, setHtml] = useState<ReactElement>();
	const [css, setCss] = useState<string>();

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
				// remove the old style tag
				const oldStyle = document.querySelector('style');
				oldStyle?.remove();
				// add the css as a style tag
				const style = document.createElement('style');
				style.innerHTML = event.data.css;
				document.head.appendChild(style);
				setCss(event.data.css);
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
		const board = document.getElementById('root');

		if (board) {
			domToPng(board).then((dataURL: string) => {
				if (counter > 0) {
					window.parent.postMessage({ dataURL, urlName }, '*');
				}
				counter++;
				// window.parent.postMessage(dataURL, '*');
			});
			// }
		}
	}, [html, css]);

	return <>{html}</>;
}

let counter = 0;

export default App;
