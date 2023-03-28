/** @format */

import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { useEffect, useState, useRef } from 'react';
import { vscodeDark, vscodeDarkInit } from '@uiw/codemirror-theme-vscode';
import {
	ReactCodeMirrorProps,
	ReactCodeMirrorRef,
} from '@uiw/react-codemirror';

import './CodeEditor.css';
interface CodeEditorProps {
	lang: any;
	title: string;
	template?: string;
	codeUpdater: (data: { html?: string; css?: string }) => void;
}

interface CodeMirrorProps extends ReactCodeMirrorProps {
	options: {
		lineWrapping?: boolean;
		lineNumbers?: boolean;
		viewportMargin?: number;
		// add any other CodeMirror options you need here
	};
}

export default function CodeEditor({
	lang = html(),
	title = 'HTML',
	template = '',
	codeUpdater,
}: CodeEditorProps) {
	const editorRef = useRef<ReactCodeMirrorRef>(null);

	const [code, setCode] = useState<string>(template);

	useEffect(() => {
		codeUpdater({ [title.toLowerCase()]: code });
	}, [code]);

	useEffect(() => {
		setCode(template);
	}, [template]);

	const editorTheme = vscodeDark;

	const cmProps: CodeMirrorProps = {
		options: {
			lineWrapping: true,
			lineNumbers: true,
			viewportMargin: Infinity,
			// add any other CodeMirror options you need here
		},
		value: code,
		extensions: [lang],
		theme: editorTheme,
		placeholder: `Write your ${title} here...`,
		style: {
			textAlign: 'left',
			// maxWidth: '840px',
		},
		maxHeight: '200px',
		onChange: (value: string, viewUpdate: ViewUpdate) => {
			setCode(value);
		},
	};

	return (
		<div
			className='codeEditor'
			style={{
				flex: '1 1 100px',
				border: '1px solid #35393C',
			}}>
			<h2
				style={{
					textShadow: '2px 5px 1px #000',
					marginTop: 10,
					userSelect: 'none',
				}}
				id='title'>
				{title}
			</h2>
			<CodeMirror {...cmProps} />
		</div>
	);
}
