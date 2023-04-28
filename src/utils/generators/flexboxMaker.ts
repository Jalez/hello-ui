/** @format */

const justifyContent = [
	'justify-content:flex-start',
	'justify-content:flex-end',
	'justify-content:center',
	'justify-content:space-between',
	'justify-content:space-around',
	'justify-content:space-evenly',
];
const alignItems = [
	'align-items:flex-start',
	'align-items:flex-end',
	'align-items:center',
	'align-items:stretch',
	'align-items:baseline',
];
const alignContent = [
	'align-content:flex-start',
	'align-content:flex-end',
	'align-content:center',
	'align-content:space-between',
	'align-content:space-around',
	'align-content:stretch',
];
const flexWrap = ['flex-wrap:wrap', 'flex-wrap:wrap-reverse'];
const flexDirection = [
	'flex-direction:row',
	'flex-direction:row-reverse',
	'flex-direction:column',
	'flex-direction:column-reverse',
];

const flex = ['flex:1'];

export const flexboxMaker = (primaryColor: string, secondaryColor: string) => {
	const randomJustifyContent =
		justifyContent[Math.floor(Math.random() * justifyContent.length)].split(
			':'
		)[1];
	const randomAlignItems =
		alignItems[Math.floor(Math.random() * alignItems.length)].split(':')[1];
	const randomAlignContent =
		alignContent[Math.floor(Math.random() * alignContent.length)].split(':')[1];
	const randomFlexWrap =
		flexWrap[Math.floor(Math.random() * flexWrap.length)].split(':')[1];
	const randomFlexDirection =
		flexDirection[Math.floor(Math.random() * flexDirection.length)].split(
			':'
		)[1];

	const html = `<div class="wrapper">
  <div class="one">One</div>
  <div class="two">Two</div>
  <div class="three">Three</div>
  <div class="four">Four</div>
  <div class="five">Five</div>
  <div class="six">Six</div>
</div>`;

	const tcss = `.wrapper {
	height: 300px;
	width: 400px;
	margin: 0;
	padding: 0;
	background-color: ${secondaryColor};
}

div>div {
	background-color: ${primaryColor};
	font-size: 2em;
	vertical-align: middle;
	text-align: center;
	margin: 0.5em;
	border-radius: 5px;
}

div>div:before {
	content: "";
	display: inline-block;
	height: 100%;
	vertical-align: middle;
}
	`;
	const scss = `
.wrapper {
display: flex;
flex-wrap: ${randomFlexWrap};
justify-content: ${randomJustifyContent};
flex-direction: ${randomFlexDirection};
align-items: ${randomAlignItems};
align-content: ${randomAlignContent};
}
div>div {
	${flex[Math.floor(Math.random() * flex.length)]};
}
`;
	return {
		HTML: html,
		SCSS: scss,
		TCSS: tcss,
	};
};
