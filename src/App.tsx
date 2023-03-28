/** @format */

import './App.css';

import { CSSWordCloud } from './components/CSSWordCloud/CSSWordCloud';
import { Navbar } from './components/Navbar/Navbar';
import { Editors } from './components/Editors/Editors';
import { ArtBoards } from './components/ArtBoards/ArtBoards';
import { Footer } from './components/Footer/Footer';
import { Title } from './components/Title/Title';

function App() {
	return (
		<>
			<Title />
			<Navbar />
			{/* <CSSWordCloud /> */}
			<ArtBoards />
			<Editors />
			<Footer />
		</>
	);
}

export default App;
