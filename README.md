# Staticman Netlify serverless edge (deno) port & simplification, forked from [Staticman](https://github.com/eduardoboucas/staticman)

[![Netlify Status](https://api.netlify.com/api/v1/badges/954d83ed-2a18-4795-860e-76cd02388bcc/deploy-status)](https://app.netlify.com/sites/blogtini/deploys)

## Changes:
- ported code from `node` to `deno`
- upgraded all JS to use ES Modules/`import` (not commonJS/`require`)
- dropped gitlab option (to simplify)
- only allow the safest/newest 'GitHub Application' option from https://staticman.net/docs/getting-started.html:
```txt
If using GitHub to host the static site repo:
Option 1. Authenticate as a GitHub application
```
- setup to run on `netlify`
- pared down config, JS files
- did a bit of `eslint` cleaning, removed some side-effects, etc.

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
- copy the GitHub setup info (App ID (number) and GitHub RSA private key) into the forked 'staticmin' repo's `netlify` setup as `netlify` secrets
- you should have these 3 secrets as environment variables configured in your https://app.netlify.com setup:
  - `GITHUB_APP_ID`
  - `GITHUB_PRIVATE_KEY`
  - `RSA_PRIVATE_KEY`

## RSA tokens (2)
To avoid encoding / secret / transport / environment variable issues, simply substitute any [NEWLINE] character in your private key files to [SPACE] characters, copy them into your `netlify` admin area `environment variables` (as _secrets_), and the updated [lib/Staticman.js](lib/Staticman.js) code will massage it properly.

## Helpful links:
- https://github.com/bashlk/staticman-netlify-function/blob/master/functions/staticman/staticman.js
- https://www.netlify.com/blog/add-personalization-to-static-html-with-edge-functions-no-browser-javascript/



