/** @format */
import { Typography } from '@mui/material';

export const tabsContent = [
	{
		label: 'Introduction',
		content: (
			<Typography sx={{ mt: 2 }} variant='body2'>
				Welcome to the UI Designer - <strong>layout edition</strong>. In these
				tasks, we'll test your skills in using CSS to create layouts.
			</Typography>
		),
	},
	{
		label: 'Objective:',
		content: (
			<>
				<Typography sx={{ mt: 2 }} variant='body2'>
					Recreate the layouts provided as images using HTML and CSS in the
					provided CSS editor. The game has two tasks:{' '}
					<em>Task 1 and Task 2</em>. You can switch between the levels using
					the <strong>LEVELS</strong> - button. You can also use the{' '}
					<strong>INSTRUCTIONS</strong>
					-button to come back to this page. Unlike in the past, the
					EVALUATE-button has now been <strong>removed</strong>, as the game now
					evaluates your code automatically: you can see your progress in the
					accuracy element, and the points you have accumulated for the given
					task in the points element. However, you still need to click the{' '}
					<strong>PLUSSA SUBMIT BUTTON</strong> in order to save the points you
					have accumulated once you are finished with these tasks.
				</Typography>
				<Typography sx={{ mt: 2 }} variant='body2'>
					Use whatever HTML and CSS techniques you know in order to recreate the
					model image as closely as possible using the provided CSS editor.
					<strong> It is highly advisable to use flexbox and grid</strong>, but
					you can also use other techniques if they are more suitable for the
					task.
				</Typography>
			</>
		),
	},
	{
		label: 'General advice',
		content: (
			<>
				<Typography variant='body2'>
					<ol>
						<li>
							<strong>Use the provided CSS template:</strong> We strongly advise
							using the existing CSS template provided, as it contains CSS rules
							that are suitable for your task. This should be used as a starting
							point for your work.
						</li>
						<li>
							<strong>HTML code is fixed:</strong> You are not allowed to change
							the HTML code for this exam. The HTML is fixed and cannot be
							altered. Your solution should be compatible with the HTML code
							provided to you.
						</li>
						<li>
							<strong>Evaluating your code:</strong> Evaluation now happens
							automatically. If your accuracy is 91% or above, you will receive
							points for the level. If you accuracy 98% or above, you will
							receive full points for the level. Accuracy below 90% will result
							in a zero point score for the level. If you refresh the page, your
							progress will be lost, in which case you will need to evaluate
							your code again.
						</li>
						<li>
							<strong>Submit your points to plussa:</strong> After completing
							the exam, ensure that you Submit the points to plussa by clicking
							the "Submit" button located beneath the game.
						</li>
					</ol>
				</Typography>
			</>
		),
	},
	{
		label: 'Remember to Submit your work',
		content: (
			<>
				<Typography sx={{ mt: 2 }} variant='body2'>
					Once you are finished with the game, remember to Submit the score to
					plussa by clicking the "Submit" button. If you refreshed the page at
					any moment in time, make sure you received the points for the tasks.
					Course Staff are available for questions during official hours through
					the Course Teams channel. Good luck!
				</Typography>
			</>
		),
	},
];
