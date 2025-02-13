import StaticMan from '../../lib/Staticman.js'

// eslint-disable-next-line no-console
const log = console.log.bind(console)

// eslint-disable-next-line consistent-return
export default async (request, context) => {
  // Look for required query parameters
  const url = new URL(request.url)
  const sp = new URLSearchParams(url.search)
  if ((sp.get('branch') ?? 'main').match(/^[a-z0-9_-]+$/i) &&
      sp.get('username')?.match(/^[a-z0-9_-]+$/i) &&
      sp.get('repository')?.match(/^[a-z0-9_-]+$/i)) {
    // Do a minor origin change, for testing this repo, via `ntl dev -p9999`,
    // against a static blog running on and posting from localhost:8888
    const origin = (context.url?.origin ?? '').replace(/:9999$/, ':8888')
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, OPTION',
    }

    if (request.method === 'OPTIONS')
      return new Response('', { statusCode: 200, headers })

    // log({ request, context })
    const body = await request.json()
    const options = body.options ?? {}
    // log({ body, options }, body.fields)

    const staticman = await new StaticMan({
      branch: sp.get('branch') ?? 'main',
      username: sp.get('username'),
      repository: sp.get('repository'),
    })

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

    return new Response('sucess', { statusCode: 200, headers })
  }
}
