# Staticman Netlify serverless edge (deno) port & simplification, forked from [Staticman](https://github.com/eduardoboucas/staticman)

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
- setup a GitHub Application with access to the other GitHub repo with your static site blog
- copy the GitHub setup info (App ID (number) and GitHub RSA private key) into the forked 'staticmin' repo's `netlify` setup as `netlify` secrets

## Helpful links:
- https://github.com/bashlk/staticman-netlify-function/blob/master/functions/staticman/staticman.js
- https://www.netlify.com/blog/add-personalization-to-static-html-with-edge-functions-no-browser-javascript/
