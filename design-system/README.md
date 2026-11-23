Lyric Engine is a quiet, utilitarian interface for walking someone through a technical setup one choice at a time. One column, one text size, one accent blue, pill-shaped controls, and soft 200ms transitions. Everything is in service of getting a person from "which language?" to a block of commands they can copy.

## Content fundamentals

- **Ask, then offer.** Each step is a single plain prompt sentence followed by its control: "Choose a programming language from which you want to use the engine:" then a select. End prompts with a colon.
- **Address the reader as "you".** "…on which you want to use…", "Install built files to /usr/local instead of…".
- **Explain the trade-off in the label itself.** Checkbox labels are full sentences that say what the option costs: "Build the debug binary. Debug binaries are much larger and slower than the release one."
- **Mark the recommended choice inline**, in parentheses after the option: "clang (recommended)".
- **Placeholder options repeat the prompt**: the first option of a select reads "Choose an operating system:".
- **Feedback is short and human.** A copy button reads "Copy", then "Copied!" or "Couldn't copy :(". That emoticon is the only playful note — no emoji anywhere else.
- Sentence case everywhere. No headings inside the flow; the sequence of prompts is the structure.

## Visual foundations

**Colour.** Set the page on `background` with all text in `color`. `color-primary` is the only accent: links, checked toggles and the focus ring. `color-primary-light` replaces it only on a focused link. The command block sits on `color-code-block`. Copy feedback swaps a button's fill and border to `color-copy-success-*` or `color-copy-fail-*` and changes its words — never colour alone.

**Light and dark.** Light and Dark follow the system preference; the two accessible themes are opt-in variants of them. Dark is not an inversion: text drops to a soft grey (`color` = rgb 190) on near-black `background`, and the success/fail fills become deep tinted blacks.

**Contrast and the accessible themes.** Light and Dark are the brand as shipped, kept exact: there `color-primary` link text on light `background` is 3.4:1, `color-primary-light` on light is 2.5:1, and `color-select-border` / `color-checkbox-background` sit near 1.5:1. Use **Accessible light** and **Accessible dark** wherever readability matters more than matching the original page: every text pair clears 4.5:1 (links 5.3:1 light, 7.4:1 dark), control borders, unchecked toggles and the focus ring clear 3:1, and accessible dark draws the check tick in near-black because white on its lighter blue fails. In every theme, copy feedback changes the button's words as well as its colour, so success and failure never rely on green versus red.

**Type.** One family, `font-sans` ('Segoe UI', Arial, Helvetica) at 16px for everything (`body`, `control`). Commands use `font-mono` (Consolas) in the `command` style. No type scale, no bold headings: hierarchy comes from order and indentation.

**Khmer.** Khmer text is set in Kantumruy Pro (`font-khmer`, loaded from Google Fonts by `bundle.css`). Mark every Khmer element `lang="km"` (or class `le-km`): it then gets `font-khmer` and a 1.7 line height (`body-km`, `control-km`), because 1.15 clips subscript consonants and vowels above and below the line. The main `font-sans` stack also lists Kantumruy Pro after Arial, so stray Khmer words inside English text still render in it, but only `lang="km"` gives them the taller line. Use `heading-km` (24px, 600) only for a page name. Write Khmer prompts the same way as English: one plain sentence ending in "៖", then its control.

**Layout and spacing.** One centred column, max `width-main` (1250px), padded `space-page` (25px). Each step is a block with `space-section` (20px) below it. Commands and their Copy button are indented `space-indent` (40px) under the sentence that introduces them. Controls pad `space-control` (5px) and sit 5px below their prompt.

**Shape.** Buttons and selects are full pills (`radius-pill`). Checkboxes are 20px squares with `radius-checkbox` (3px); radios are 20px circles (`radius-round`). The command block is square.

**Borders and depth.** Controls have a 1px `color-select-border` border and the page's own fill — flat, no shadows. The only shadow is `shadow-focus`, a solid 3px `color-primary` ring on `:focus-visible`; mouse focus shows nothing.

**Motion.** Every state change eases over 200ms: border, padding and ring on controls; fill on toggles; the radio dot grows from the centre (width/height/position 200ms, colour 100ms); link underlines fade in on hover from a transparent `text-decoration-color`. Nothing moves on its own.

**Toggles.** Checkboxes and radios are drawn, not native: unchecked `color-checkbox-background`, checked `color-primary` with a `color-checkbox-tick` tick, or a 16px `color-primary` dot for radios.

## Iconography

None. The source uses no icon set, no logo and no imagery: controls are text, the command list uses "$ " as its bullet, and checkboxes draw their tick in CSS. Keep it that way — if you need an affordance, use words.

## Components

Button (with copy states), Select, Checkbox, Radio, Link, CommandBlock — all plain HTML styled by `components/bundle.css` classes (`le-button`, `le-select`, `le-checkbox`, `le-radio`, `le-link`, `le-command`). There is no JavaScript bundle; the source page is static markup.
