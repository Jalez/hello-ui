/** @format */

export const Footer = () => {
	return (
		<footer
			style={{
				margin: 0,
				fontSize: 10,
				// center the text
				textAlign: 'center',
				color: '#333',
				padding: 5,
				// give a shadow to the text
			}}>
			Creating art with the magic of your mind and the power of HTML and CSS.
			Inspired by
			<a
				href='https://cssbattle.dev/'
				target='_blank'
				rel='noreferrer'
				style={{
					// Give a dark yellow color
					color: '#f5c518',
					// color: '#',
					textDecoration: 'none',
					margin: 10,
				}}>
				CSS Battle
			</a>
		</footer>
	);
};
