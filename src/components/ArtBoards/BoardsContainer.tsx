/** @format */

const boardsContainerStyle = {
	display: 'flex' as const,
	flexDirection: 'row' as const,
	flexWrap: 'wrap' as const,
	borderRadius: '10px',
	padding: '2em',
	justifyContent: 'space-evenly',
	alignItems: 'center',
	position: 'relative' as const,
	overflow: 'hidden',
	boxSizing: 'border-box' as const,
	width: '100%',
	flex: '1 0 auto',
};

interface BoardsContainerProps {
	children: React.ReactNode;
}

export const BoardsContainer = ({ children }: BoardsContainerProps) => {
	return (
		<div className='boards-container' style={boardsContainerStyle}>
			{children}
		</div>
	);
};
