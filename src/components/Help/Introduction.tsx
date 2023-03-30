/** @format */

import * as React from 'react';
import {
	Box,
	Button,
	Typography,
	Modal,
	Backdrop,
	Fade,
	Paper,
} from '@mui/material';
import { CSSWordCloud } from '../CSSWordCloud/CSSWordCloud';

const style = {
	position: 'absolute' as 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	width: 600,
	height: 600,
	overflow: 'auto',
	// bgcolor: '#222',
	// bgcolor: 'background.paper',
	// border: '2px solid #000',
	border: 'none',
	boxShadow: 24,
	p: 4,
};

const wordCloud = {
	position: 'absolute' as 'absolute',
	// top: '50%',
	// left: '50%',
	transform: 'translate(-50%, -50%)',
	width: 700,
	bgcolor: 'white',
	zIndex: 4,
};

export default function Introduction() {
	const [open, setOpen] = React.useState(true);
	// const handleOpen = () => setOpen(true);
	const handleClose = () => setOpen(false);

	return (
		<>
			{/* <Fade in={open}>
				<Paper elevation={0} sx={wordCloud}>
					<CSSWordCloud />
				</Paper>
			</Fade> */}
			<Modal
				aria-labelledby='transition-modal-title'
				aria-describedby='transition-modal-description'
				open={open}
				onClose={handleClose}
				closeAfterTransition
				slots={{ backdrop: Backdrop }}
				slotProps={{
					backdrop: {
						timeout: 500,
					},
				}}>
				<Fade in={open}>
					<Paper sx={style}>
						<Typography id='transition-modal-title' variant='h4' component='h4'>
							Introduction
						</Typography>
						<Typography id='transition-modal-description' sx={{ mt: 2 }}>
							Welcome to the UI Designer! This game is where you practice and
							sharpen your HTML and CSS problem solving skills by recreating UI
							components provided as images. Please read the following
							instructions before you begin.
						</Typography>
						<section>
							<article>
								<header>
									<Typography
										id='transition-modal-title'
										variant='h5'
										component='h5'>
										Objective:
									</Typography>
								</header>
								<Typography id='transition-modal-description' sx={{ mt: 2 }}>
									Recreate the UI components provided as images using HTML and
									CSS in the provided editors. The game has four levels:{' '}
									<em>Button, Card, Card with Image, and Picture Gallery.</em>{' '}
									You can switch between the 4 levels using the{' '}
									<strong>LEVELS</strong> - button. Use the{' '}
									<strong>EVALUATE</strong>-button to evaluate the precision of
									your HTML and CSS code. You can also use the{' '}
									<strong>HELP</strong>-button to access the help section (This
									feature is not yet fully implemented).
								</Typography>
								<Typography id='transition-modal-description' sx={{ mt: 2 }}>
									The pictures have been taken from working components in
									Chrome, not all browsers will render them identically, ie. you
									may not be able to recreate the exact same look in all
									browsers. The goal is to recreate the look as close as
									possible. Over 98% accuracy earns you the full points, but you
									need to get more than 90% accuracy to get points at all.
								</Typography>

								<section>
									<article>
										<header>
											<Typography
												id='transition-modal-title'
												variant='h6'
												component='h6'>
												Levels
											</Typography>
										</header>
										<Typography
											id='transition-modal-description'
											sx={{ mt: 2 }}>
											Each level has a set of UI components that you need to
											recreate. The levels are: Button, Card, Card with Image,
											and Picture Gallery. We recommend the following steps in
											designing your UI components:
										</Typography>
										<Paper
											style={{
												fontFamily: 'monospace',
												fontSize: '1rem',
												margin: '1rem',
												padding: '1rem',
											}}>
											<ol>
												<li>
													<strong>Analyze the image:</strong> The first step is
													to analyze the image and identify its key components
													such as colors, shapes, and text. This will help the
													designer to determine the appropriate HTML tags and
													CSS properties to use when recreating the image.
												</li>
												<li>
													<strong>
														Use appropriate HTML and CSS techniques:{' '}
													</strong>
													After analyzing the image, the designer (meaning you)
													should use appropriate HTML and CSS techniques to
													recreate the component as closely to the original as
													possible. Use the appropriate HTML elements, such as
													&lt;button&gt; or &lt;img&gt;. Pay attention to the
													elements's size, color, font, and border effects.{' '}
													<strong>Use flexbox and grid when needed</strong>. The
													20 most common CSS properties should be sufficient to
													recreate any of the images presented in the game.
												</li>
												<li>
													<strong>Test your code:</strong> After you are
													finished, use the EVALUATE- button to test your code.
													If you get a score of 90% or more, you will get points
													for the level. If you get a score of 98% or more, you
													will get full points for the level. If you get a score
													of less than 90%, you will not get any points for the
													level. You may need to make adjustments to the HTML
													and CSS code to fix any layout or styling issues.
												</li>
											</ol>
										</Paper>
										<Typography
											id='transition-modal-description'
											sx={{ mt: 2 }}>
											Once you are finished with the game, remember to Submit
											the score to plussa by clicking the "Submit" button.
										</Typography>
									</article>
								</section>
								<section
									style={{
										display: 'flex',
										justifyContent: 'center',
									}}>
									<Button onClick={handleClose}>
										<strong>That's it. let's start designing!</strong>
									</Button>
								</section>
							</article>
						</section>
					</Paper>
				</Fade>
			</Modal>
		</>
	);
}
