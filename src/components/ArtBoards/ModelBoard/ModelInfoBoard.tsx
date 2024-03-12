/** @format */

// ModelInfoBoard.tsx
import { InfoBoard } from '../../InfoBoard/InfoBoard';
import { InfoColors } from '../../InfoBoard/InfoColors';
import { InfoPictures } from '../../InfoBoard/InfoPictures';
import { InfoSwitch } from '../../InfoBoard/InfoSwitch';

type ModelInfoBoardProps = {
	showModel: boolean;
	setShowModel: (show: boolean) => void;
};

export const ModelInfoBoard = ({
	showModel,
	setShowModel,
}: ModelInfoBoardProps) => (
	<InfoBoard>
		<InfoColors />
		<InfoPictures />
		<InfoSwitch
			label={showModel ? 'Show model' : 'Show diff'}
			checked={showModel}
			switchHandler={() => setShowModel(!showModel)}
		/>
	</InfoBoard>
);
