/** @format */

import { Spinner } from '../Spinner/Spinner';

// interface
interface ModelProps {
	imageUrl: string;
	name: string;
}

export const Image = ({ imageUrl, name }: ModelProps): JSX.Element => {
	return (
		<div
			style={{
				margin: 0,
				height: '300px',
			}}>
			<div>
				{imageUrl ? (
					<img
						src={imageUrl}
						alt='
					The image that the user will draw a copy of
					'
						width={400}
					/>
				) : (
					<Spinner />
				)}
			</div>
		</div>
	);
};
