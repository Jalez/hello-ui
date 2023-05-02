/** @format */

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { updateUrl } from '../../store/slices/levels.slice';
import { useAppDispatch } from '../../store/hooks/hooks';
// import my redux store

// prop types
interface FrameProps {
	newHtml: string;
	newCss: string;
	id: string;
	name: string;
	frameUrl?: string;
}

export const Frame = ({
	id,
	newHtml,
	newCss,
	name,
	frameUrl = 'http://localhost:3500/' ||
		'https://tie-lukioplus.rd.tuni.fi/drawboard/',
}: FrameProps) => {
	// create a ref for the iframe
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const dispatch = useAppDispatch();
	const { currentLevel } = useSelector((state: any) => state.currentLevel);

	useEffect(() => {
		const resendDataAfterMount = (event: MessageEvent) => {
			if (event.data === 'mounted') {
				// Send the new html and css to the iframe
				iframeRef.current?.contentWindow?.postMessage(
					{
						html: newHtml,
						css: newCss,
						name,
					},
					'*'
				);
			}
		};

		//Listen for messages from the iframe
		window.addEventListener('message', resendDataAfterMount);

		return () => {
			// cleanup
			window.removeEventListener('message', resendDataAfterMount);
		};
	}, []);

	useEffect(() => {
		const handleDataFromIframe = async (event: MessageEvent) => {
			// if (event.origin !== frameUrl) return;
			// Check the src of the message

			if (!event.data.dataURL) return;
			// What is the type of event.data.dataurl?
			// console.log(typeof event.data.dataURL);
			dispatch(updateUrl({ ...event.data, id: currentLevel }));
			// set the src of the image to the data url
			// when the image loads, draw it to the canvas
		};

		window.addEventListener('message', handleDataFromIframe);

		return () => {
			window.removeEventListener('message', handleDataFromIframe);
		};
	}, [currentLevel]);

	useEffect(() => {
		// wait for the iframe to load
		const iframe = iframeRef.current;

		// wait for the iframe to load

		if (iframe) {
			// send a message to the iframe
			iframe.contentWindow?.postMessage(
				{
					html: newHtml,
					css: newCss,
					name,
				},
				'*'
			);
		}
	}, [newHtml, newCss, iframeRef, currentLevel]);

	return (
		<iframe
			id={id}
			ref={iframeRef}
			src={frameUrl}
			style={{
				width: '400px',
				height: '300px',
				overflow: 'hidden',
				border: 'none',
				backgroundColor: '#2b2b2e',
			}}></iframe>
	);
};
