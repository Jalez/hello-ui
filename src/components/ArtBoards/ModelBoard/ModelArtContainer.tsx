/** @format */

// ModelArtContainer.tsx
import { Frame } from '../Frame';

import { ArtContainer } from '../ArtContainer';
import { useAppSelector } from '../../../store/hooks/hooks';

type ModelArtContainerProps = {
	children: JSX.Element;
};

export const ModelArtContainer = ({ children }: ModelArtContainerProps) => {
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);

	return (
		<ArtContainer>
			{!level.solutionUrl && (
				<Frame
					id='DrawBoard'
					newCss={level.solution.css}
					newHtml={level.solution.html}
					name='solutionUrl'
				/>
			)}
			<div
				style={{
					position: 'absolute',
					bottom: 0,
				}}>
				{children}
			</div>
		</ArtContainer>
	);
};
