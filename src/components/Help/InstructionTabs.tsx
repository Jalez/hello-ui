/** @format */

import DynamicTabs from '../General/DynamicTabs/DynamicTabs';
import { tabsContent } from './InstructionContent';

const tabsStyle = {
	padding: 0,
	maxHeight: 400,
	backgroundColor: '#D4AF37',
	overflow: 'auto',
	boxShadow: '0px 2px 1px rgba(0, 0, 0, 0.25)',
};

const InstructionTabs = () => {
	return (
		<div style={{ padding: 30 }}>
			<DynamicTabs style={tabsStyle} tabs={tabsContent} />
		</div>
	);
};

export default InstructionTabs;
