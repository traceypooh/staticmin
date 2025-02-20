import StaticMan from '../../lib/Staticman.js'

// eslint-disable-next-line no-console
const log = console.log.bind(console)

// eslint-disable-next-line consistent-return, no-unused-vars
export default async (request, context) => {
  // Look for required path pattern *OR* query parameters
  const url = new URL(request.url)
  const sp = new URLSearchParams(url.search)

  if (url.pathname === '/')
    return new Response('greetings, earthling', { statusCode: 200 })

  // eg: /v3/entry/github/traceypooh/blogtini/main/comments
  const dirs = url.pathname.match(/\/v\d+\/entry\/[^/]+\/([^/]+)\/([^/]+)\/([^/]+)\/comments/)
  if (!dirs)
    return new Response('page not found', { statusCode: 404 })

  const [, username, repository, branch] = dirs

  if (!branch?.match(/^[a-z0-9_-]+$/i) ||
      !username?.match(/^[a-z0-9_-]+$/i) ||
      !repository?.match(/^[a-z0-9_-]+$/i)) {
    return new Response('page not found', { statusCode: 404 })
  }

  // Do a minor origin change, for testing this repo, via `ntl dev -p9999`,
  // against a static blog running on and posting from localhost:8888
  // const cors_origin = (url.origin ?? '*').replace(/:9999$/, ':8888')

  const headers = {
    // 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Origin': '*', // request.method === 'OPTIONS' ? '*' : cors_origin,
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  if (request.method === 'OPTIONS')
    return new Response('', { statusCode: 200, headers })

  // log({ request, context })
  const body = await request.json()
  const options = body.options ?? {}
  // log({ body, options }, body.fields)

  const staticman = await new StaticMan({ branch, username, repository })

  if (request.headers.get('client-ip'))
    staticman.setIp(request.headers.get('client-ip'))
  staticman.setUserAgent(request.headers.get('user-agent'))

  try {
    const processed = await staticman.processEntry(body.fields, options)
    log({ processed })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error({ err })
  }

  return new Response('success', { statusCode: 200, headers })
}

export const config = { path: '/*' }
