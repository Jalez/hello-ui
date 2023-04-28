/** @format */

import { Button, ButtonGroup } from '@mui/material';
import CodeEditor from './CodeEditor/CodeEditor';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks/hooks';
import { updateCode } from '../../store/slices/levels.slice';
import { useSelector } from 'react-redux';

// interface EditorsProps {
// 	codeUpdater: (data: { html?: string; css?: string }) => void;
// 	htmlCode: string;
// 	cssCode: string;
// }

export const Editors = () => {
	const dispatch = useAppDispatch();
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const levels = useAppSelector((state: any) => state.levels);
	const [htmlCode, setHTMLCode] = useState<string>(
		levels[currentLevel - 1].code.html
	);
	const [cssCode, setCSSCode] = useState<string>(
		levels[currentLevel - 1].code.css
	);

	useEffect(() => {
		setHTMLCode(levels[currentLevel - 1].code.html);
		setCSSCode(levels[currentLevel - 1].code.css);
	}, [currentLevel]);
	const codeUpdater = (data: { html?: string; css?: string }) => {
		dispatch(
			updateCode({
				id: currentLevel,
				code: { ...levels[currentLevel - 1].code, ...data },
			})
		);
		if (data.html) {
			setHTMLCode(data.html);
		}
		if (data.css) {
			setCSSCode(data.css);
		}
	};

	return (
		<div
			className='editors'
			style={{
				display: 'flex',
				flexDirection: 'row',
				alignContent: 'center',
				justifyContent: 'space-between',
				maxWidth: '840px',
				flex: '1 1 auto',
				position: 'relative',
				width: '100%',
				backgroundColor: '#1E1E1E',
				// flexWrap: 'wrap',
			}}>
			<CodeEditor
				lang={css()}
				title='CSS'
				codeUpdater={codeUpdater}
				template={cssCode}
			/>
			<CodeEditor
				lang={html()}
				title='HTML'
				codeUpdater={codeUpdater}
				template={htmlCode}
				locked={true}
			/>

			{/* <ButtonGroup
				variant='contained'
				aria-label='Code editor button group'
				// color='primary'
				sx={{
					display: 'flex',
					flexDirection: 'row',
					alignContent: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					borderRadius: '0',
					bgcolor: '#35393C',
				}}>
				<Button sx={{ flex: '1 1 auto' }} onClick={buttonClickHandler}>
					Execute
				</Button>
			</ButtonGroup> */}
		</div>
	);
};
