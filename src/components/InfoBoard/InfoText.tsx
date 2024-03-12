/** @format */
// create prop interface
interface NavTextProps {
	children: any;
}
/**
 * @description InfoText is a component that displays text in the InfoBoard component
 * @param {NavTextProps} props - props for component,
 * @param {any} props.children - children of component
 * @returns {JSX.Element}
 */
export const InfoText = ({ children }: NavTextProps) => {
	return (
		<p
			style={{
				textAlign: 'center',
				// dont allow selection
				userSelect: 'none',
				// show the back blurred
				// backdropFilter: 'blur(10px)',
			}}>
			{children}
		</p>
	);
};
