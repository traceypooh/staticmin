#!/usr/bin/env node
/*
  One-time: converts a site's older comments -- one file each, in `comments/<post>/<id>.json` -- into the one
  `comments.json` file staticmin now writes (see README "Comments file" & "Avatars").  For each comment:
    - `path` (the post), then keys in staticmin's order: body, date, id, replyID, name, website, ...
    - its `email` md5 => `identity`, + `type` (eg: `png`) if they have a Gravatar (saved as `avatars/<identity>.<type>`)
      (an empty, or non-md5, `email` is just dropped)
    - dropped: empty fields (eg: `replyID` when not a reply), and the old Hugo theme's `replyThread` & `replyName`
      (the thread & replied-to name are found from `replyID`)
  Comments already in `comments.json` (by `id`) are skipped, so rerunning is harmless.
  It never deletes anything: once happy, remove the old dir yourself (eg: `git rm -r comments`).

  Run from the top of your site repo, eg:
    GITHUB_PRIVATE_KEY="$(pbpaste)" node ~/d/staticmin/bin/convert-comments.js traceypooh/poohbot --dry-run

  - `<user>/<repo>`: exactly as in your site's comment-posting url (eg: .../v3/entry/github/traceypooh/poohbot/...)
  - `GITHUB_PRIVATE_KEY`: the same key as in netlify -- spaces-for-newlines (like netlify's), or the `.pem` file's own.
    Only ever passed in like this, never saved.
  - `--dry-run`: change nothing, just report
*/
import fs from 'node:fs'
import { pem_fix, identity, gravatar } from '../lib/avatars.js'
import * as CommentsFile from '../lib/comments_file.js'

// eslint-disable-next-line no-console
const log = console.log.bind(console)

const args = process.argv.slice(2)
const dry = args.includes('--dry-run')
const [username, repository] = (args.find((e) => e.includes('/')) ?? '').split('/')
const secret = pem_fix(process.env.GITHUB_PRIVATE_KEY)

if (!username || !repository || !secret || !fs.existsSync('comments')) {
  log('usage (from the top of your site repo, w/ its comments/ dir):')
  log('  GITHUB_PRIVATE_KEY="..." node convert-comments.js <user>/<repo> [--dry-run]')
  process.exit(1)
}

let text = fs.existsSync(CommentsFile.FILE) ? fs.readFileSync(CommentsFile.FILE, 'utf8') : null
const have = new Set(CommentsFile.parse(text).map((e) => e.id))

const people = {} // md5 => { identity, found (their Gravatar, or null) } -- so each is fetched once
let converted = 0

for (const dir of fs.readdirSync('comments', { withFileTypes: true }).filter((e) => e.isDirectory())) {
  for (const name of fs.readdirSync(`comments/${dir.name}`).filter((e) => e.endsWith('.json') && e !== 'index.json')) {
    const old = JSON.parse(fs.readFileSync(`comments/${dir.name}/${name}`, 'utf8'))
    const {
      // eslint-disable-next-line no-unused-vars
      _id, id, email, body, date, replyID, name: who, website, identity: had, type, avatar, replyThread, replyName, ...rest
    } = old
    const comment = {
      path: dir.name, body, date, id: _id ?? id ?? name.replace(/\.json$/, ''), replyID, name: who, website,
    }
    if (have.has(comment.id)) continue

    const md5 = String(email ?? '').trim().toLowerCase()
    if (md5.match(/^[0-9a-f]{32}$/)) {
      if (!people[md5]) {
        // eslint-disable-next-line no-await-in-loop
        const found = await gravatar(md5).catch((err) => log(`  gravatar fetch failed: ${err?.message}`) ?? null)
        people[md5] = { identity: identity(secret, username, repository, md5), found }
      }
      comment.identity = people[md5].identity
      if (people[md5].found) comment.type = people[md5].found.ext
    } else if (had) {
      comment.identity = had // (already converted, eg: by an earlier version of this)
      const ext = type ?? avatar?.split('.').pop() // (earlier versions wrote `avatar: avatars/<identity>.<ext>`)
      if (ext) comment.type = ext
    }

    const all = { ...comment, ...rest }
    text = CommentsFile.insert(text, Object.fromEntries(Object.entries(all).filter(([, v]) => v !== '' && v != null)))
    have.add(comment.id)
    converted += 1
  }
}

const avatars = Object.values(people).filter((e) => e.found)
if (!dry) {
  if (converted) fs.writeFileSync(CommentsFile.FILE, text)
  if (avatars.length) fs.mkdirSync('avatars', { recursive: true })
  for (const e of avatars)
    fs.writeFileSync(`avatars/${e.identity}.${e.found.ext}`, e.found.bytes)
}

log(`${dry ? '[dry run] would add' : 'added'} ${converted} comments to ${CommentsFile.FILE}, from ${Object.keys(people).length} people`)
log(`${dry ? '[dry run] would save' : 'saved'} ${avatars.length} Gravatars${avatars.length ? ' into avatars/' : ''}`)
if (!dry && converted) log('check it (eg: your site locally), then remove the old dir, eg: git rm -r comments')
