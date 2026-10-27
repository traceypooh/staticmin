/*
  `comments.json`: every comment for the whole site, in one file -- so a site needs no build step to show them.
  Deliberately *not* valid JSON (a speed bump for bots that fetch & parse every .json) -- it's lines like:
    #0
    #1
    {
      "path": "about",
      "body": "nice!",
      ...
    },
    #2
  - 972 "slot" marker lines: `#` + an optional letter + a letter or digit (`#0`..`#z`, then `#a0`..`#zz`).
    They're never edited.
  - each comment: pretty-printed, *always* ending `},` (the last one, too), inserted right after a random marker.
  Why: each comment's pull request then changes only lines no other pull request touches -- so two pending
  comments merge cleanly (even w/ GitHub's web "Merge" button), unless they pick the same slot (~1 in 972).
  To read it: drop the marker lines, and the final `,` -- then it's a JSON array (see `parse()`).
  (A marker line can't appear inside a comment: JSON strings never hold a raw newline.)
*/

const FILE = 'comments.json'

const CHARS = [...'0123456789abcdefghijklmnopqrstuvwxyz']
const MARKERS = [
  ...CHARS.map((e) => `#${e}`),
  ...CHARS.slice(10).flatMap((first) => CHARS.map((e) => `#${first}${e}`)),
]

/** A new, empty comments file: just the markers */
function empty() {
  return `${MARKERS.join('\n')}\n`
}

/**
 * Inserts `comment` right after a random slot marker
 * @param {string|null} text  the comments file (`null` if there isn't one yet)
 * @param {object} comment
 */
function insert(text, comment) {
  const all = text ?? empty()
  const marker = MARKERS[Math.floor(Math.random() * MARKERS.length)]
  const entry = `${JSON.stringify(comment, null, 2)},`
  const line = new RegExp(`^${marker}$`, 'm')
  // (a function, so `$` chars in a comment aren't taken as replacement patterns)
  if (line.test(all)) return all.replace(line, () => `${marker}\n${entry}`)
  return `${all.replace(/\n*$/, '\n')}${marker}\n${entry}\n` // (marker hand-deleted? add it back, at the end)
}

/** All the comments in a comments file, as an array */
function parse(text) {
  return JSON.parse(`[${(text ?? '').replace(/^#[a-z]?[0-9a-z]$/gm, '').trim().replace(/,$/, '')}]`)
}

export {
  FILE, MARKERS, empty, insert, parse,
}
