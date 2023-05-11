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
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const dispatch = useAppDispatch();
	const { currentLevel } = useSelector((state: any) => state.currentLevel);

	useEffect(() => {
		const resendDataAfterMount = (event: MessageEvent) => {
			if (event.data === 'mounted') {
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

		window.addEventListener('message', resendDataAfterMount);

		return () => {
			window.removeEventListener('message', resendDataAfterMount);
		};
	}, []);

	useEffect(() => {
		const handleDataFromIframe = async (event: MessageEvent) => {
			if (!event.data.dataURL) return;
			dispatch(updateUrl({ ...event.data, id: currentLevel }));
		};

		window.addEventListener('message', handleDataFromIframe);

		return () => {
			window.removeEventListener('message', handleDataFromIframe);
		};
	}, [currentLevel]);

	useEffect(() => {
		// wait for the iframe to load
		const iframe = iframeRef.current;

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
