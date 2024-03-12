/** @format */

import { Tab, Tabs, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useState } from 'react';
import { useSelector } from 'react-redux';

const style = {
	position: 'absolute' as 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	width: 400,
	// bgcolor: 'background.paper',
	bgcolor: '#fff',
	border: '2px solid #000',
	color: 'black',
	boxShadow: 24,
	p: 4,
};

interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

function TabPanel(props: TabPanelProps) {
	const { children, value, index, ...other } = props;

	return (
		<div
			role='tabpanel'
			hidden={value !== index}
			id={`simple-tabpanel-${index}`}
			aria-labelledby={`simple-tab-${index}`}
			{...other}>
			{value === index && (
				<Box sx={{ p: 3 }}>
					<Typography>{children}</Typography>
				</Box>
			)}
		</div>
	);
}

function a11yProps(index: number) {
	return {
		id: `simple-tab-${index}`,
		'aria-controls': `simple-tabpanel-${index}`,
	};
}

export const HelpContent = () => {
	const [value, setValue] = useState(0);
	// get the description from the store state
	const { currentLevel } = useSelector((state: any) => state.currentLevel);
	const levelDetails = useSelector(
		(state: any) => state.levels[currentLevel - 1]
	);
	const { description } = levelDetails.help;

	const titlesAndDescriptions = [
		{
			title: 'General',
			description:
				'As a CSS artist, your task in this game is to recreate images using HTML and CSS. Utilize the available editors to write your code and once you are satisfied with your work, click the "EVALUATE" button to receive feedback. Successfully replicating the images with sufficient accuracy will enable you to pass the level. Best of luck!',
		},
		{
			title: 'This level',
			description: description,
		},
	];

	const handleChange = (event: React.SyntheticEvent, newValue: number) => {
		setValue(newValue);
	};

	return (
		<Box sx={style}>
			<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
				<Tabs
					value={value}
					onChange={handleChange}
					aria-label='basic tabs example'>
					{titlesAndDescriptions.map((titleAndDescription, index) => (
						<Tab label={titleAndDescription.title} {...a11yProps(index)} />
					))}
				</Tabs>
			</Box>
			{titlesAndDescriptions.map((titleAndDescription, index) => (
				<TabPanel value={value} index={index}>
					<Typography id='help-modal-title' variant='h6' component='h3'>
						{titleAndDescription.title}
					</Typography>
					<Typography id='help-modal-description' sx={{ mt: 2 }}>
						{titleAndDescription.description}
					</Typography>
				</TabPanel>
			))}
		</Box>
	);
};
