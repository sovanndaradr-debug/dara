A monospace block of shell commands, one per line with a "$ " bullet, indented under the sentence that introduces it.

**Use** `<code class="le-command"><ul><li>command</li>…</ul></code>`, followed by a Copy `le-button` with `le-indent`. Ground `color-code-block`, text `color` in `command` style, padding `space-control`, left margin `space-indent`; it scrolls sideways rather than wrapping.

**Consumer provides** the commands as plain text, without the "$ " (the list bullet adds it), and the copy handler. Hide the Copy button when the commands can't be run as-is.
