# Staticman Netlify serverless functions port & simplification, forked from [Staticman](https://github.com/eduardoboucas/staticman)


[![Deploy with Netlify button](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/traceypooh/staticmin)

[![Netlify Status](https://api.netlify.com/api/v1/badges/ff727fd1-d4a0-44ab-b927-c16e4c06ad4e/deploy-status)](https://app.netlify.com/sites/blogtini/deploys)


## Changes:
- upgraded all JS to use ES Modules/`import` (not commonJS/`require`)
- dropped gitlab option (to simplify)
- only allow the safest/newest 'Authenticate as a GitHub application' option from https://staticman.net/docs/getting-started.html
- setup to run on `netlify`
- pared down config, JS files
- did a bit of `eslint` cleaning, removed some side-effects, etc.
- ported code from `node` to `deno` (in alternate "serverless edge" branch named `deno`)

## Getting started
- fork this repo 'staticmin'
- tie this forked repo into `netlify`
  - [this link](https://www.netlify.com/blog/add-personalization-to-static-html-with-edge-functions-no-browser-javascript/) shows how to get the `ntl` binary, and hook in your forked repo to `netlify` for deploying, via `ntl login` and `ntl init`, etc.
  - you'll end up:
    -  adding a new GitHub 'deploy key' to your blog repo that `ntl` creates for you
    -  adding a `webhook` to your blog repo that has individual events (allowances):
     - `Branch or tag deletion`
     - `Pull requests`
     - `Pushes`
- setup a GitHub Application with access to the other GitHub repo with your static site blog
- copy the GitHub setup info (App ID (number) and GitHub RSA private key (string)) into the forked 'staticmin' repo's `netlify` setup as `netlify` secrets
- you should have these 2 secrets as environment variables configured in your https://app.netlify.com setup:
  - `GITHUB_APP_ID`
  - `GITHUB_PRIVATE_KEY`

## Private Keys
To avoid encoding / secret / transport / environment variable issues, simply substitute any [NEWLINE] character in your private key string to [SPACE] characters, copy it into your `netlify` admin area `environment variables` (as _secrets_), and the updated [lib/Staticman.js](lib/Staticman.js) code will massage it properly.

To simplify setup, if you needed for some reason to have [encrypted data](https://staticman.net/docs/encryption) in your `staticman.yml` file, we'll use your (RSA) `githubPrivateKey` to encrypt the data (so you don't have to generate another RSA key).


## Comments file
Every comment goes into one `comments.json` file at the top of your site repo -- so your site needs no build
step to show them.  Each comment is a pull request adding a few lines to it, at a random one of 972 "slots", so
two pending comments almost never conflict (~1 in 972), even w/ GitHub's web "Merge" button.
It's deliberately *not* valid JSON (a speed bump for bots) -- see [lib/comments_file.js](lib/comments_file.js)
for the format & the 1-line way to read it.  (So `staticman.yml`'s `format`, `path`, `filename` aren't used.)

Older comments (one file each, in `comments/<post>/`): convert them once w/
[bin/convert-comments.js](bin/convert-comments.js) (its top comment has how).


## Avatars
A comment's `email` is never stored -- not even as an md5 (which anyone can match against a guessed email).
Instead:
- the comment gets an `identity`: a key that's the same for each commenter, but reveals nothing about them
  (an HMAC of the email's md5, w/ your `githubPrivateKey` as the secret -- so, again, no extra secret)
- if they have a [Gravatar](https://gravatar.com), it's saved in the same pull request as `avatars/<identity>.<ext>`
  (120px), and the comment gets its `"type"` (eg: `"png"`) -- so site visitors never load anything from
  gravatar.com, and no build step is needed to show it.  Unchanged images aren't re-committed.
  (Just the type, not the whole path: so the comments file doesn't spell out "this name => this picture".)

Nothing to set up. Optionally, in your site's `staticman.yml`:
```yaml
  avatars: "img/avatars"   # a different directory (blogtini & its Hugo theme look in `avatars/` though)
  avatars: ""              # no images in your repo (still no email; everyone gets an identicon)
```

NOTE: if you ever replace your GitHub App private key, *new* comments get new identities -- so a commenter's
older comments keep their avatar as it was, and stop getting their Gravatar updates.


## Helpful links:
- https://github.com/bashlk/staticman-netlify-function/blob/master/functions/staticman/staticman.js
- https://www.netlify.com/blog/add-personalization-to-static-html-with-edge-functions-no-browser-javascript/



