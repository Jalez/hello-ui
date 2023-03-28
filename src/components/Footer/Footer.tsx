/** @format */

export const Footer = () => {
	return (
		<footer
			style={{
				margin: 0,
				fontSize: 10,
				// center the text
				textAlign: 'center',
				color: '#ccc',
				backgroundColor: '#333',
				padding: 5,
				// give a shadow to the text
				textShadow: '2px 1px 1px #000',
			}}>
			Creating art with the magic of your mind and the power of HTML and CSS.
			Inspired by
			<a
				href='https://cssbattle.dev/'
				target='_blank'
				rel='noreferrer'
				style={{
					color: 'yellow',
					textDecoration: 'none',
					margin: 5,
				}}>
				{' '}
				CSS Battle
			</a>
			.
		</footer>
	);
};
