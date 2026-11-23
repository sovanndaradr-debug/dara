A drawn 20px radio for picking one of a few inline options.

**Use** a `<fieldset class="le-fieldset">` whose `<legend>` is the prompt, holding `<label class="le-label"><input class="le-radio" type="radio" name="…">Option</label>` per option, so screen readers announce what the group answers. Unchecked fill `color-checkbox-background`; checking grows a 16px `color-primary` dot from the centre over 200ms. In the accessible themes a checked radio shows a 2px `color-primary` ring on `background` with a 10px dot, so the state reads at 3:1 or better. Mark the suggested option inline: "clang (recommended)".

**Consumer provides** the shared `name`, options and the prompt text.
