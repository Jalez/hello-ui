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
		<>
			<LevelUpdater />
			<Introduction />
			{open && (
				<Grow in={open} {...(checked ? { timeout: 2000 } : {})}>
					<Paper
						elevation={10}
						sx={{}}
						style={{
							position: 'absolute' as 'absolute',
							top: '50%',
							left: '50%',
							transform: 'translate(-50%, -50%)',
							width: '850px',
							height: 800,
							padding: 10,
							overflow: 'none',
							backgroundColor: '#222',
							// bgcolor: '#222',
							// bgcolor: '#222',
							// border: '2px solid #000',
							border: 'none',
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'space-between',
						}}>
						<Navbar />
						{/* <CSSWordCloud /> */}
						<ArtBoards />
						<Editors />
						{/* <Footer /> */}
					</Paper>
				</Grow>
			)}
		</>
	);
}

export default App;
