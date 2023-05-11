/** @format */

import { useState } from 'react';
import { Diff } from './Diff/Diff';
import { BoardContainer } from '../BoardContainer';
import { BoardTitle } from '../BoardTitle';
import { Board } from '../Board';
import { ModelInfoBoard } from './ModelInfoBoard';
import { ModelArtContainer } from './ModelArtContainer';
import { Model } from './Model';

export const ModelBoard = (): JSX.Element => {
	const [showModel, setShowModel] = useState(true);

	return (
		<BoardContainer>
			<BoardTitle>Model version</BoardTitle>
			<Board>
				<ModelInfoBoard showModel={showModel} setShowModel={setShowModel} />
				<ModelArtContainer>
					{showModel ? <Model /> : <Diff />}
				</ModelArtContainer>
			</Board>
		</BoardContainer>
	);
};
