/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import { decode as base64decode, encode as base64encode } from 'js-base64'
import yaml from 'js-yaml'
import errorHandler from './ErrorHandler.js'

class GitService {
  constructor(username, repository, branch) {
    this.username = username
    this.repository = repository
    this.branch = branch
  }

  // eslint-disable-next-line no-unused-vars
  _pullFile(filePath, branch) {
    throw new Error('Abstract method `_pullFile` should be implemented')
  }

  // eslint-disable-next-line no-unused-vars
  _commitFile(filePath, contents, commitTitle, branch) {
    throw new Error('Abstract method `_commitFile` should be implemented')
  }

  // eslint-disable-next-line no-unused-vars
  getBranchHeadCommit(branch) {
    throw new Error('Abstract method `getBranchHeadCommit` should be implemented')
  }

  // eslint-disable-next-line no-unused-vars
  createBranch(branch, sha) {
    throw new Error('Abstract method `createBranch` should be implemented')
  }

  // eslint-disable-next-line no-unused-vars
  deleteBranch(branch) {
    throw new Error('Abstract method `deleteBranch` should be implemented')
  }

  // eslint-disable-next-line no-unused-vars
  createReview(commitTitle, branch, reviewBody) {
    throw new Error('Abstract method `createReview` should be implemented')
  }

  // eslint-disable-next-line no-unused-vars
  getReview(reviewId) {
    throw new Error('Abstract method `getReview` should be implemented')
  }

  getCurrentUser() {
    throw new Error('Abstract method `getCurrentUser` should be implemented')
  }

  async readFile(path, getFullResponse) {
    const extension = path.split('.').pop()

    // eslint-disable-next-line no-underscore-dangle
    const res = await this._pullFile(path, this.branch)

    let content
    try {
      content = base64decode(res.content)
    } catch (err) {
      throw errorHandler('GITHUB_READING_FILE', { err })
    }

    try {
      // eslint-disable-next-line default-case
      switch (extension) {
      case 'yml':
      case 'yaml':
        content = yaml.safeLoad(content, 'utf8')

        break

      case 'json':
        content = JSON.parse(content)

        break
      }

      // strange issue i noticed that didnt seem to affect the upstream staticman repo this was
      // forked from
      if (path === 'staticman.yml' && content.comments) content = content.comments

      if (getFullResponse) {
        return {
          content,
          file: {
            content: res.content,
          },
        }
      }

      return content
    } catch (err) {
      const errorData = { err }

      if (err.message) {
        errorData.data = err.message
      }

      throw errorHandler('PARSING_ERROR', errorData)
    }
  }

  writeFile(filePath, data, branch = this.branch, commitTitle = 'Add Staticman file') {
    return this._commitFile(filePath, base64encode(data), commitTitle, branch)
  }

  writeFileAndSendReview(filePath, data, branch, commitTitle = 'Add Staticman file', reviewBody = '') {
    return this.getBranchHeadCommit(this.branch)
      .then((sha) => this.createBranch(branch, sha))
      .then(() => this.writeFile(filePath, data, branch, commitTitle))
      .then(() => this.createReview(commitTitle, branch, reviewBody))
  }
}

export default GitService
