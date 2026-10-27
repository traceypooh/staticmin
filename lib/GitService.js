/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
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

  // `data`: a string, or bytes (eg: an image).  `sha`: needed to update an existing file.
  writeFile(filePath, data, branch = this.branch, commitTitle = 'Add Staticman file', sha = undefined) {
    const content = typeof data === 'string' ? base64encode(data) : Buffer.from(data).toString('base64')
    return this._commitFile(filePath, content, commitTitle, branch, sha)
  }

  // Like `writeFile()`, but skips it when the file is already there, unchanged.
  async writeFileIfChanged(filePath, data, branch, commitTitle) {
    const sha = await this._pullFile(filePath, branch).then((res) => res.sha).catch(() => undefined)
    const bytes = Buffer.from(data)
    // (git's own sha for a file's contents, to compare w/ what's there)
    const blob_sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    if (sha === blob_sha) return null

    return this.writeFile(filePath, bytes, branch, commitTitle, sha)
  }

  // `data`: the file's new contents -- or a function: `(text) => new contents`, to *change* the file
  //   (it gets the file's text on the new branch, or `null` if there's no such file yet)
  // `extraFiles`: optional more `{ path, data }` to commit to the same branch (eg: an avatar image)
  writeFileAndSendReview(filePath, data, branch, commitTitle = 'Add Staticman file', reviewBody = '', extraFiles = []) {
    return this.getBranchHeadCommit(this.branch)
      .then((sha) => this.createBranch(branch, sha))
      .then(async () => {
        if (typeof data !== 'function') return this.writeFile(filePath, data, branch, commitTitle)

        // (read from the new branch -- so the sha we update from is surely the one there)
        // NOTE: GitHub's contents API only returns files up to 1 MB
        const res = await this._pullFile(filePath, branch).catch(() => null)
        const text = res ? base64decode(res.content) : null
        return this.writeFile(filePath, data(text), branch, commitTitle, res?.sha)
      })
      .then(async () => {
        // (one at a time -- each is a commit on the same branch)
        for (const e of extraFiles)
          // eslint-disable-next-line no-await-in-loop
          await this.writeFileIfChanged(e.path, e.data, branch, commitTitle)
      })
      .then(() => this.createReview(commitTitle, branch, reviewBody))
  }
}

export default GitService
