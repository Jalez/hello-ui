/** @format */

interface BoardProps {
	children: React.ReactNode;
}

const boardStyle = {
	backgroundColor: '#333',
	marginTop: '5px',
	marginBottom: '5px',
	padding: '0px',
	flexShrink: 0,
	height: 'fit-content',
	width: 'fit-content',
	boxSizing: 'content-box' as const, //Ensures that typescript treats the value as a literal type of 'content-box' instead of a string
	overflow: 'hidden',
	border: '5px solid #111',
	zIndex: 2,
};

export const Board = ({ children }: BoardProps) => {
	return (
		<div className='board' style={boardStyle}>
			{children}
		</div>
	);
};
