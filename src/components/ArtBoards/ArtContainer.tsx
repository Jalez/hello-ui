/** @format */

interface ArtContainerProps {
	children: React.ReactNode;
}

export const ArtContainer = ({ children }: ArtContainerProps) => {
	return (
		<div
			className='img-container'
			style={{
				position: 'relative',
				height: '300px',
			}}>
			{children}
		</div>
	);
};
