A pill-shaped text button that sits flush with the page, used for actions such as copying commands.

**Use** `<button class="le-button">` with a short text label. It has the page's own fill (`background`), a 1px `color-select-border` border and `radius-pill`; padding `space-control`, text in `control`.

**States.** Keyboard focus shows `shadow-focus`. For copy feedback, add `success` (fill `color-copy-success-background`, border `color-copy-success-border`, label "Copied!") or `fail` (`color-copy-fail-*`, label "Couldn't copy :("), and return to "Copy" afterwards. Always change the words with the colour.

**Consumer provides** the label and the click handler. When it acts on a command block, indent it with `le-indent` to line up with the block.

Don't fill it with `color-primary`; there is no primary-filled button in this system.
