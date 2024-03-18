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
    label: "Objective",
    content: (
      <>
        <Typography sx={{ mt: 2 }} variant="body2">
          Recreate the components provided as images using HTML and CSS in the
          provided CSS editor. Depending on setup, the game may have a number of
          levels(tasks): You can switch between the levels using the{" "}
          <strong>LEVEL</strong> - navigational system inside the application.
          You can also use the <strong>?</strong>
          -button to come back to this page. You can see your progress in the
          points you have accumulated for the given task in the element above
          your own designs picture. However, you still need to click the{" "}
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
        <ol>
          <li>
            <Typography sx={{ mt: 2 }} variant="body2">
              <strong>Use the provided CSS/HTML template:</strong> We strongly
              advise using the existing CSS/HTML template provided, as it
              contains CSS rules and HTML elements that are suitable for your
              task. This should be used as a starting point for your work.{" "}
              <strong>Beware:</strong> HTML is always wrapped in a div with the
              id "root".
            </Typography>
          </li>
          <li>
            <Typography sx={{ mt: 2 }} variant="body2">
              <strong>Evaluating your code:</strong> Evaluation happens
              automatically. The more accurate web-component you design, the
              more points you get.
            </Typography>
          </li>
          <li>
            <Typography sx={{ mt: 2 }} variant="body2">
              <strong>Submit your points to plussa:</strong> After completing
              the exam, ensure that you Submit the points to plussa by clicking
              the "Submit" button located beneath the game.
            </Typography>
          </li>
        </ol>
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
