/*
  Commenter identities & avatars -- shared by `Staticman.js` and `bin/convert-comments.js`,
  so both always make the exact same `identity` for the same person.  See README "Avatars".
*/
import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'

/**
 * To avoid encoding / secret / transport / environment variable issues,
 * the RSA key's value can have substituted any [NEWLINE] character in the string to
 * [SPACE] characters. So now update the values to valid PEM format.
 * (A key w/ real newlines, eg: straight from the `.pem` file, comes out the same.)
 */
function pem_fix(key) {
  return key?.trim()
    .replace(/  +/g, ' ')
    .replace(/ /g, '\n')
    .replace(/BEGIN\nRSA\nPRIVATE\nKEY-----\s*/, 'BEGIN RSA PRIVATE KEY-----\n')
    .replace(/\s*-----END\nRSA\nPRIVATE\nKEY-----/, '\n-----END RSA PRIVATE KEY-----')
}

/**
 * An HMAC: the same person always gets the same key (per repo) -- but w/o the secret,
 * no one can get from a guessed email to its key.  (So keys reveal nothing, unlike md5s.)
 * The secret: our (required) GitHub App private key (after `pem_fix()`), so there's no extra secret to set up.
 * NOTE: changing that key gives *new* comments new identities. Older comments keep theirs (& their
 * avatar files) -- so a commenter's older comments just stop getting their Gravatar updates.
 * @param {string} md5  of their (trimmed, lowercased) email
 */
function identity(secret, username, repository, md5) {
  return createHmac('sha256', secret)
    .update(`${username}/${repository}/${md5}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Their Gravatar, as `{ ext, bytes }` -- or null if none (or slow, too big, or not a usual image type)
 * @param {string} md5  of their (trimmed, lowercased) email
 */
async function gravatar(md5) {
  // 120px: 2x the 60px blogtini shows.  `d=404`: no Gravatar => 404 (not a default image)
  const res = await fetch(`https://www.gravatar.com/avatar/${md5}?s=120&d=404`, {
    signal: AbortSignal.timeout(3000),
  })
  const ext = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  }[res.headers.get('content-type')]
  const bytes = res.ok && ext ? Buffer.from(await res.arrayBuffer()) : null
  return bytes?.length && bytes.length < 100_000 ? { ext, bytes } : null
}

export { pem_fix, identity, gravatar }
