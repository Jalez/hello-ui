/** @format */
import './Navbar.css';
import { Grid } from '@mui/material';
import { LeftNav } from './LeftNav/LeftNav';
import { RightNav } from './RightNav/RightNav';
import { ThreeNavs } from './ThreeNavs/ThreeNavs';

export const Navbar = () => {
	return (
		<div
			className='navbar'
			style={{ fontSize: '1.5em', backgroundColor: '#1E1E1E' }}>
			<ThreeNavs />
			{/* <Grid container>
				<Grid item xs={6}>
					<LeftNav></LeftNav>
				</Grid>
				<Grid item xs={6}>
					<RightNav></RightNav>
				</Grid>
			</Grid> */}
		</div>
	);
};
