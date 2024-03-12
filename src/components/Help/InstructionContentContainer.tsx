/** @format */

interface InstructionContentProps {
	children: React.ReactNode;
}
const InstructionContent = ({ children }: InstructionContentProps) => {
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				flexGrow: 1,
			}}>
			{children}
		</div>
	);
};

export default InstructionContent;
