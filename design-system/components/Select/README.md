A pill-shaped native select for choosing one option in a step of the flow.

**Use** `<select class="le-select">` directly under the prompt sentence it answers. The first option repeats the prompt as a placeholder ("Choose an operating system:") and is written `<option value="" disabled selected>` so it can never be submitted as an answer. Styling matches Button: `background` fill, `color-select-border` border, `radius-pill`, `control` text, `shadow-focus` on keyboard focus.

**Consumer provides** the options and an accessible name (the prompt, via `<label>` or `aria-label`). Reveal the next step only once a real option is picked.
