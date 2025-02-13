import convict from 'https://esm.sh/convict@^4.3.0'

const schema = {
  githubAppID: {
    doc: 'ID of the GitHub App.',
    format: String,
    default: null,
    env: 'GITHUB_APP_ID',
  },
  githubBaseUrl: {
    doc: 'Base URL for the GitHub API (optional).',
    format: String,
    default: 'https://api.github.com',
    env: 'GITHUB_BASE_URL',
  },
  githubPrivateKey: {
    doc: 'Private key for the GitHub App.',
    format: String,
    default: null,
    env: 'GITHUB_PRIVATE_KEY',
  },
  rsaPrivateKey: {
    doc: 'RSA private key to encrypt sensitive configuration parameters with.',
    docExample: 'rsaPrivateKey: "-----BEGIN RSA PRIVATE KEY-----\\nkey\\n-----END RSA PRIVATE KEY-----"',
    format: String,
    default: null,
    env: 'RSA_PRIVATE_KEY',
  },
}


export default () => {
  let config
  try {
    config = convict(schema)

    let configjson
    try {
      // generally, we expect the 3 required key/vals to be environment variables (secrets) via
      // netlify setup.  But we can read and use this file if it exists for alt universe/testing.
      configjson = Deno.readTextFileSync('config.production.json')
      // eslint-disable-next-line no-empty
    } catch {}
    if (configjson) {
      config.load(JSON.parse(configjson))
    }
    // console.log({ config })
    config.validate()

    console.log('(*) Local config file loaded')
  } catch (e) {
    console.error({ e })
  }

  return config
}
