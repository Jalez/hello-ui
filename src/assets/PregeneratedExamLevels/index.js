/** @format */

import Easy1 from './Easy/1.png';
import Easy2 from './Easy/2.png';
import Medium1 from './Medium/1.png';
import Medium2 from './Medium/2.png';
import Hard1 from './Hard/1.png';
import Hard2 from './Hard/2.png';

export const levels = {
	1: [
		{
			image: Easy1,
			colors: ['#f5f5f5', '#acacac', '#1e88e5'],
			pictures: [],
		},
	],
	2: [
		{
			image: Medium1,
			colors: ['#ff0000', '#00ff00', '#0000ff'],
			pictures: [],
		},
		{
			image: Medium2,
			colors: ['white', 'black', '#f5f5f5', '#1e88e5', '#3e8e41'],
			pictures: [],
		},
	],
	3: [
		{
			image: Hard1,
			colors: ['#ff0000', '#00ff00', '#0000ff'],
			pictures: [],
		},
		{
			image: Hard2,
			colors: [
				'#544bd4',
				'#5f8f6b',
				'#d49e4b',
				'#9c0c0c',
				'#7322be85',
				'aqua',
				'white',
			],
			pictures: [],
		},
	],
};
