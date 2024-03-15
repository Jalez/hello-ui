/** @format */
import { Typography } from "@mui/material";

export const tabsContent = [
  {
    label: "Introduction",
    content: (
      <Typography sx={{ mt: 2 }} variant="body2">
        Welcome to the UI Designer. In these tasks, we'll test your skills using
        HTML and CSS to create and design components.
      </Typography>
    ),
  },
  {
    label: "Objective:",
    content: (
      <>
        <Typography sx={{ mt: 2 }} variant="body2">
          Recreate the components provided as images using HTML and CSS in the
          provided CSS editor. The game may have a number of levels(tasks): You
          can switch between the levels using the <strong>LEVELS</strong> -
          button. You can also use the <strong>INSTRUCTIONS</strong>
          -button to come back to this page. You can see your progress in the
          points you have accumulated for the given task in the points element
          above your own designs picture. However, you still need to click the{" "}
          <strong>PLUSSA SUBMIT BUTTON</strong> in order to save the points you
          have accumulated once you are finished with these tasks.
        </Typography>
        <Typography sx={{ mt: 2 }} variant="body2">
          Use whatever HTML and CSS techniques you know in order to recreate the
          model image as closely as possible using the provided editors. In some
          tasks, you are unable to use one of the editors (these are marked
          "LOCKED")
        </Typography>
      </>
    ),
  },
  {
    label: "General advice",
    content: (
      <>
        <Typography variant="body2">
          <ol>
            <li>
              <strong>Use the provided CSS/HTML template:</strong> We strongly
              advise using the existing CSS/HTML template provided, as it
              contains CSS rules and HTML elements that are suitable for your
              task. This should be used as a starting point for your work.
            </li>
            <li>
              <strong>Evaluating your code:</strong> Evaluation happens
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
    label: "Remember to Submit your work",
    content: (
      <>
        <Typography sx={{ mt: 2 }} variant="body2">
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
