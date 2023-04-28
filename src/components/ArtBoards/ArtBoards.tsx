/** @format */

import './ArtBoard.css';
import { Drawboard } from './Drawboard/Drawboard';
import { ModelBoard } from './ModelBoard/ModelBoard';

export const ArtBoards = () => {
	return (
		<div id='artBoard'>
			<Drawboard />
			<ModelBoard />
		</div>
	);
};
