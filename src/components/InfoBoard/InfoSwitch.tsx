/** @format */

import { FormControlLabel, Switch, Typography } from '@mui/material';

interface InfoSwitchProps {
	switchHandler: () => void;
	label: string;
	checked: boolean;
}

export const InfoSwitch = ({
	label,
	switchHandler,
	checked,
}: InfoSwitchProps) => {
	return (
		<FormControlLabel
			control={
				<Switch
					// Change color to #D4AF37
					color='primary'
					checked={checked}
					// fire when switch is clicked
					onChange={() => switchHandler()}
				/>
			}
			style={{
				userSelect: 'none',
				// color: '#D4AF37',
			}}
			label={<Typography variant='body1'>{label}</Typography>}
			labelPlacement='start'
		/>
	);
};
