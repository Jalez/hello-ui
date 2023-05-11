/** @format */

interface BoardContainerProps {
	children: React.ReactNode;
}

const containerStyles = {
	display: 'flex' as const,
	flexDirection: 'row' as const,
	justifyContent: 'center',
	alignItems: 'center',
	flex: '1 0 auto',
	flexShrink: 0,
	width: 500,
};

export const BoardContainer = ({ children }: BoardContainerProps) => {
	return <div style={containerStyles}>{children}</div>;
};
