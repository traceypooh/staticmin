/* eslint-disable no-underscore-dangle */
import GithubApi from 'https://esm.sh/@octokit/rest@^16.35.0'
import { App } from 'https://esm.sh/@octokit/app@^4.1.0'
import { request } from 'https://esm.sh/@octokit/request@^5.3.1'

import errorHandler from './ErrorHandler.js'
import GitService from './GitService.js'
import Review from './models/Review.js'
import User from './models/User.js'

const normalizeResponse = ({data}) => data

class GitHub extends GitService {
  constructor(config, options = {}) {
    super(options.username, options.repository, options.branch)

    this.config = config

    // eslint-disable-next-line no-constructor-return
    return (async () => {
      if (!config.get('githubAppID')) throw new Error('Requires `githubAppID` option')
      if (!config.get('githubPrivateKey')) throw new Error('Requires `githubPrivateKey` option')

      const authToken = await this._authenticate(options.username, options.repository)
      this.api = GithubApi({
        auth: `token ${authToken}`,
        userAgent: 'Staticman',
        baseUrl: config.get('githubBaseUrl'),
        request: {
          timeout: 5000
        }
      })

      return this
    })()
  }

  async _authenticate(username, repository) {
    const app = new App(
      {
        id: this.config.get('githubAppID'),
        privateKey: this.config.get('githubPrivateKey'),
        baseUrl: this.config.get('githubBaseUrl')
      }
    )

    const jwt = app.getSignedJsonWebToken()

    const {data} = await request('GET /repos/:owner/:repo/installation', {
      owner: username,
      repo: repository,
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: 'application/vnd.github.machine-man-preview+json'
      }
    })

    const installationId = data.id

    let token = await app.getInstallationAccessToken({installationId})

    return token
  }

  _pullFile (filePath, branch) {
    return this.api.repos.getContents({
      owner: this.username,
      repo: this.repository,
      path: filePath,
      ref: branch
    })
      .then(normalizeResponse)
      .catch(err => Promise.reject(errorHandler('GITHUB_READING_FILE', {err})))
  }

  _commitFile (filePath, content, commitMessage, branch) {
    return this.api.repos.createOrUpdateFile({
      owner: this.username,
      repo: this.repository,
      path: filePath,
      message: commitMessage,
      content,
      branch
    })
      .then(normalizeResponse)
  }

  writeFile (filePath, data, targetBranch, commitTitle) {
    return super.writeFile(filePath, data, targetBranch, commitTitle)
      .catch(err => {
        try {
          const message = err && err.message

          if (message) {
            const parsedError = JSON.parse(message)

            if (
              parsedError &&
              parsedError.message &&
              parsedError.message.includes('"sha" wasn\'t supplied')
            ) {
              return Promise.reject(errorHandler('GITHUB_FILE_ALREADY_EXISTS', {err}))
            }
          }
        } catch (err) {
          console.log(err)
        }

        return Promise.reject(errorHandler('GITHUB_WRITING_FILE'))
      })
  }

  getBranchHeadCommit (branch) {
    return this.api.repos.getBranch({
      owner: this.username,
      repo: this.repository,
      branch
    })
      .then(res => res.data.commit.sha)
  }

  createBranch (branch, sha) {
    return this.api.git.createRef({
      owner: this.username,
      repo: this.repository,
      ref: `refs/heads/${branch}`,
      sha
    })
      .then(normalizeResponse)
  }

  deleteBranch (branch) {
    return this.api.git.deleteRef({
      owner: this.username,
      repo: this.repository,
      ref: `heads/${branch}`
    })
  }

  createReview (reviewTitle, branch, reviewBody) {
    return this.api.pullRequests.create({
      owner: this.username,
      repo: this.repository,
      title: reviewTitle,
      head: branch,
      base: this.branch,
      body: reviewBody
    })
      .then(normalizeResponse)
  }

  getReview (reviewId) {
    return this.api.pulls.get({
      owner: this.username,
      repo: this.repository,
      pull_number: reviewId
    })
      .then(normalizeResponse)
      .then(({base, body, head, merged, state, title}) =>
        new Review(
          title,
          body,
          (merged && state === 'closed') ? 'merged' : state,
          head.ref,
          base.ref
        )
      )
  }

  async readFile (filePath, getFullResponse) {
    try {
      return await super.readFile(filePath, getFullResponse)
    } catch (err) {
      throw errorHandler('GITHUB_READING_FILE', {err})
    }
  }

  writeFileAndSendReview (filePath, data, branch, commitTitle, reviewBody) {
    return super.writeFileAndSendReview(filePath, data, branch, commitTitle, reviewBody)
      .catch(err => Promise.reject(errorHandler('GITHUB_CREATING_PR', {err})))
  }

  getCurrentUser () {
    return this.api.users.getAuthenticated({})
      .then(normalizeResponse)
      .then(({login, email, avatar_url, name, bio, company, blog}) =>
        new User('github', login, email, name, avatar_url, bio, blog, company)
      )
      .catch(err => Promise.reject(errorHandler('GITHUB_GET_USER', {err})))
  }
}

export default GitHub
