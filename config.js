import convict from 'https://esm.sh/convict@^4.3.0'

const schema = {
  githubAppID: {
    doc: 'ID of the GitHub App.',
    format: String,
    default: null,
    env: 'GITHUB_APP_ID'
  },
  githubBaseUrl: {
    doc: 'Base URL for the GitHub API.',
    format: String,
    default: 'https://api.github.com',
    env: 'GITHUB_BASE_URL'
  },
  githubPrivateKey: {
    doc: 'Private key for the GitHub App.',
    format: String,
    default: null,
    env: 'GITHUB_PRIVATE_KEY'
  },
  port: {
    doc: 'The port to bind the application to.',
    format: 'port',
    default: 0,
    env: 'PORT'
  },
  rsaPrivateKey: {
    doc: 'RSA private key to encrypt sensitive configuration parameters with.',
    docExample: 'rsaPrivateKey: "-----BEGIN RSA PRIVATE KEY-----\\nkey\\n-----END RSA PRIVATE KEY-----"',
    format: String,
    default: null,
    env: 'RSA_PRIVATE_KEY'
  },
}


export default () => {
  let config
  try {
    config = convict(schema)
    const cj = JSON.parse(Deno.readTextFileSync('config.production.json'))
    config.load(cj)
    // console.log({ config })
    config.validate()

    console.log('(*) Local config file loaded')
  } catch (e) {
    console.error({ e }) // xxx
  }

  return config
}
