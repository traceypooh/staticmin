import convict from 'convict'

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
}


export default () => {
  let config
  try {
    config = convict(schema)
    config.validate()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error({ e })
  }

  return config
}
