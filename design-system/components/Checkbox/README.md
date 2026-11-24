A drawn 20px checkbox for opt-in build options, always followed by a full-sentence label.

**Use** `<label class="le-label"><input class="le-checkbox" type="checkbox">Label sentence.</label>`. Unchecked fill `color-checkbox-background`, checked `color-primary` with a `color-checkbox-tick` tick; `radius-checkbox` corners, `size-toggle` square, `space-control` gap to the label. Fill eases over 200ms.

**Consumer provides** the label, which should state what the option costs or gains. The unchecked box is low-contrast by design (from the source), so never show a checkbox without its label.
