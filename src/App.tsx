/** @format */

import './App.css';

import { CSSWordCloud } from './components/CSSWordCloud/CSSWordCloud';
import { Navbar } from './components/Navbar/Navbar';
import { Editors } from './components/Editors/Editors';
import { ArtBoards } from './components/ArtBoards/ArtBoards';
import { Footer } from './components/Footer/Footer';
import { Title } from './components/Title/Title';
import Introduction from './components/Help/Introduction';
import Grow from '@mui/material/Grow';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useState } from 'react';
import { useAppSelector } from './store/hooks/hooks';
import { Paper } from '@mui/material';
import { useEffect } from 'react';
import { LevelUpdater } from './LevelUpdater';

function App() {
	const [checked, setChecked] = useState(false);
	const room = useAppSelector((state) => state.room);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (room.currentRoom === 'game') {
			setOpen(true);
		} else {
			setOpen(false);
		}
	}, [room.currentRoom]);

	return (
		<div
			id='App'
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				alignItems: 'center',
				height: '100%', // "90%
				// overflow: 'auto',
				position: 'relative',
			}}>
			<LevelUpdater />
			{!open && <Introduction />}
			{open && (
				<Grow in={open} {...(checked ? { timeout: 200 } : {})}>
					<Paper
						elevation={10}
						style={{
							width: '100%',
							//height: 800,
							padding: 10,
							overflow: 'none',
							backgroundColor: '#222',
							// bgcolor: '#222',
							// bgcolor: '#222',
							// border: '2px solid #000',
							border: 'none',
							display: 'flex',
							flexDirection: 'row',
							justifyContent: 'space-between',
							flexWrap: 'wrap',
						}}>
						<Navbar />
						{/* <CSSWordCloud /> */}
						<ArtBoards />
						<Editors />
						{/* <Footer /> */}
					</Paper>
				</Grow>
			)}
		</div>
	);
}

export default App;
