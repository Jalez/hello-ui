/** @format */

import * as React from 'react';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

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
			{value === index && <Box sx={{ p: 3 }}>{children}</Box>}
		</div>
	);
}

interface TabProps {
	style?: React.CSSProperties;
	tabs: {
		label: string;
		// Make content expect a React.ReactNode
		content: React.ReactNode;
	}[];
}

function allyProps(index: number) {
	return {
		id: `simple-tab-${index}`,
		'aria-controls': `simple-tabpanel-${index}`,
	};
}

export default function DynamicTabs({ style, tabs }: TabProps) {
	const [value, setValue] = React.useState(0);

	const handleChange = (event: React.SyntheticEvent, newValue: number) => {
		setValue(newValue);
	};

	return (
		<Box>
			<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
				<Tabs
					variant='scrollable'
					scrollButtons
					allowScrollButtonsMobile
					value={value}
					onChange={handleChange}
					aria-label='basic tabs example'>
					{tabs.map((tab, index) => (
						<Tab label={tab.label} {...allyProps(index)} key={index} />
					))}
				</Tabs>
			</Box>
			{tabs.map((tab, index) => (
				<div style={style} key={index}>
					<TabPanel value={value} index={index}>
						{tab.content}
					</TabPanel>
				</div>
			))}
		</Box>
	);
}
