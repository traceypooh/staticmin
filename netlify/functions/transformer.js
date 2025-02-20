import StaticMan from '../../lib/Staticman.js'

// eslint-disable-next-line no-console
const log = console.log.bind(console)

// eslint-disable-next-line consistent-return, no-unused-vars
export default async (request, context) => {
  // Look for required path pattern
  const url = new URL(request.url)

  if (url.pathname === '/')
    return new Response('greetings, earthling', { statusCode: 200 })

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  // eg: /v3/entry/github/traceypooh/blogtini/main/comments
  const dirs = url.pathname.match(/\/v\d+\/entry\/github\/([^/]+)\/([^/]+)\/([^/]+)\/comments/)
  if (!dirs) {
    headers.Location = '/404'
    return new Response(null, { statusCode: 302, headers })
  }

  const [, username, repository, branch] = dirs

  if (!branch?.match(/^[a-z0-9_-]+$/i) ||
      !username?.match(/^[a-z0-9_-]+$/i) ||
      !repository?.match(/^[a-z0-9_-]+$/i)) {
    headers.Location = '/404'
    return new Response(null, { statusCode: 302, headers })
  }

  if (request.method === 'OPTIONS')
    return new Response('', { statusCode: 200, headers })

  // log({ request, context })
  const body = await request.json()
  const options = body.options ?? {}
  // log({ body, options }, body.fields)

  try {
    const staticman = await new StaticMan({ branch, username, repository })
    const processed = await staticman.processEntry(body.fields, options)
    log({ processed })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error({ err })
  }

  return new Response('success', { statusCode: 200, headers })
}

export const config = { path: '/*' }
