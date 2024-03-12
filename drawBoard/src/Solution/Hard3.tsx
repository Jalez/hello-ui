/** @format */

import './DrawBoard.css';
import html2canvas from 'html2canvas';
import { useRef } from 'react';

export const DrawBoard = ({ rrref = useRef<HTMLDivElement>(null) }) => {
	console.log(document.styleSheets[1].cssRules);

	return (
		<div className='draw-board' ref={rrref}>
			<div id='a'></div> <div id='d'></div>
			<div id='e'>
				<div id='f'>
					<div id='j'>
						<div id='i'></div>
					</div>
				</div>
			</div>
			<div id='c'>
				<div id='b'>
					<div id='g'>
						<div id='h'></div>
					</div>
				</div>
			</div>
		</div>
	);
};
