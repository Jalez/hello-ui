/** @format */

import './App.css';

import { Navbar } from './components/Navbar/Navbar';
import { Editors } from './components/Editors/Editors';
import { ArtBoards } from './components/ArtBoards/ArtBoards';
import Instruction from './components/Help/Instruction';
import { LevelUpdater } from './LevelUpdater';
import { GameContainer } from './GameContainer';

const AppStyle = {
	display: 'flex',
	flexDirection: 'column' as const,
	justifyContent: 'space-between',
	alignItems: 'center',
	height: '100%',
	position: 'relative' as const,
};

function App() {
	return (
		<div id='App' style={AppStyle}>
			<LevelUpdater />
			<Instruction />
			<GameContainer>
				<Navbar />
				<ArtBoards />
				<Editors />
			</GameContainer>
		</div>
	);
}

export default App;
