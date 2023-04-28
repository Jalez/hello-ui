/** @format */

import { cssPropertiesArray } from './CSSProperties';
import { WordCloud } from './WordCloud/WordCloud';

export const CSSWordCloud = () => {
	return (
		<div
			style={{
				position: 'absolute',
				zIndex: 0,
				padding: '0px',
				margin: '0px',
			}}>
			<WordCloud words={cssPropertiesArray} />
		</div>
	);
};
