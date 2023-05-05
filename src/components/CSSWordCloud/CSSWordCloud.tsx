/** @format */

import { cssPropertiesArray } from './CSSProperties';
import { WordCloud } from './WordCloud/WordCloud';

export const CSSWordCloud = () => {
	return (
		<div
			style={{
				position: 'absolute',
				zIndex: 1,
				top: '0%',
				left: '0%',
				padding: '0px',
				margin: '0px',
				width: '100%',
				display: 'flex',
				justifyContent: 'center',
			}}>
			<WordCloud words={cssPropertiesArray} />
		</div>
	);
};
