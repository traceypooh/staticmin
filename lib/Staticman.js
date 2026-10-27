// https://github.com/bashlk/staticman-netlify-function/blob/master/functions/staticman/staticman.js

/* eslint-disable no-underscore-dangle */
import markdownTable from 'markdown-table'
import moment from 'moment'
import NodeRSA from 'node-rsa'
import objectPath from 'object-path'
import slugify from 'slug'
import { v1 as uuidv1 } from 'uuid'

import { pem_fix, identity, gravatar } from './avatars.js'
import * as CommentsFile from './comments_file.js'
import SiteConfig  from './siteConfig.js'
import parse_config from './config.js'
import errorHandler  from './ErrorHandler.js'
import * as gitFactory from './GitServiceFactory.js'
import * as Transforms  from './Transforms.js'

// eslint-disable-next-line no-console
const log = console.log.bind(console)

class Staticman {
  constructor(parameters) {
    // eslint-disable-next-line no-constructor-return
    return (async () => {
      this.parameters = parameters
      this.config = parse_config()
      const {
        repository,
        username,
        branch = 'main',
      } = parameters

      // (the key can have [SPACE]s for [NEWLINE]s -- see `pem_fix()`)
      const key = 'githubPrivateKey'
      this.config.set(key, pem_fix(this.config.get(key)))

      // Initialise the Git service API
      this.git = await gitFactory.create(this.config, {
        branch,
        repository,
        username,
      })

      // Generate unique id
      this.uid = uuidv1()

      // NOTE: this key is used to decrypt any (unlikely to happen with our streamlined setup)
      // encrypted strings (eg: tokens or secrets) in a user's `staticman.yml` file.
      // To keep things simple, we'll simply use the *required* `githubPrivateKey` RSA key for this
      // so that a user doesn't have to make a second RSA private key just for this.
      this.rsa = new NodeRSA()
      this.rsa.importKey(this.config.get('githubPrivateKey'), 'private')

      return this
    })()
  }

  /**
   * The comment, as stored in `comments.json` -- keys in this order, so `path` and the parts spammers
   * fill in (body, website) are easy to see when moderating.  Empty ones (eg: `replyID` when not a reply)
   * are left out.
   */
  _comment(fields) {
    const {
      body, date, replyID, name, website, ...rest
    } = fields
    const comment = {
      path: this.options.entryId ?? '', body, date, id: this.uid, replyID, name, website, ...rest,
    }
    return Object.fromEntries(Object.entries(comment).filter(([, v]) => v !== '' && v !== undefined && v !== null))
  }

  /**
   * Swaps the commenter's email for a private `identity` key -- so no email (nor its md5) ever reaches git --
   * and stages their Gravatar (if any) as `<dir>/<identity>.<ext>`, for the same pull request.
   * `<dir>`: `avatars` (or the site's staticman.yml `avatars:`; `""`: no images, identity only)
   */
  async _applyAvatar(fields) {
    const dir = this.siteConfig.get('avatars').replace(/\/+$/, '')

    const email = String(fields.email ?? '').trim().toLowerCase()
    // eslint-disable-next-line no-param-reassign
    delete fields.email
    if (!email) return fields

    const md5 = Transforms.md5(email)
    // eslint-disable-next-line no-param-reassign
    fields.identity = identity(this.config.get('githubPrivateKey'), this.parameters.username, this.parameters.repository, md5)

    if (!dir) return fields // (site wants no images in its repo -- identicons only)

    try {
      const found = await gravatar(md5)
      if (found) {
        this.avatar_file = { path: `${dir}/${fields.identity}.${found.ext}`, data: found.bytes }
        // so the site knows there's an image, & its name -- `avatars/<identity>.<type>` -- w/o a build step.
        // (Deliberately not the whole path: the comments file then doesn't spell out names => pictures.)
        // eslint-disable-next-line no-param-reassign
        fields.type = found.ext
      }
    } catch (err) {
      log('avatars: gravatar fetch failed', err?.message)
    }

    return fields
  }

  _applyGeneratedFields(data) {
    const generatedFields = this.siteConfig.get('generatedFields')

    if (!generatedFields) return data

    Object.keys(generatedFields).forEach((field) => {
      const generatedField = generatedFields[field]

      if ((typeof generatedField === 'object') && (!(generatedField instanceof Array))) {
        const options = generatedField.options || {}

        // eslint-disable-next-line default-case
        switch (generatedField.type) {
        case 'date':
          // eslint-disable-next-line no-param-reassign
          data[field] = this._createDate(options)

          break

          // TODO: Remove 'github' when v2 API is no longer supported
        case 'github':
        case 'user':
          if (this.gitUser && typeof options.property === 'string') {
            // eslint-disable-next-line no-param-reassign
            data[field] = objectPath.get(this.gitUser, options.property)
          }

          break

        case 'slugify':
          if (
            typeof options.field === 'string' &&
              typeof data[options.field] === 'string'
          ) {
            // eslint-disable-next-line no-param-reassign
            data[field] = slugify(data[options.field]).toLowerCase()
          }

          break
        }
      } else {
        // eslint-disable-next-line no-param-reassign
        data[field] = generatedField
      }
    })

    return data
  }

  _applyTransforms(fields) {
    const transforms = this.siteConfig.get('transforms')

    if (!transforms) return Promise.resolve(fields)

    // This doesn't serve any purpose for now, but we might want to have
    // asynchronous transforms in the future.
    const queue = []

    Object.keys(transforms).forEach((field) => {
      if (!fields[field]) return

      const transformNames = [].concat(transforms[field])

      transformNames.forEach((transformName) => {
        const transformFn = Transforms[transformName]

        if (transformFn) {
          // eslint-disable-next-line no-param-reassign
          fields[field] = transformFn(fields[field])
        }
      })
    })

    return Promise.all(queue).then(() => fields)
  }


  // eslint-disable-next-line class-methods-use-this
  _createDate(options = {}) {
    const date = new Date()

    switch (options.format) {
    case 'timestamp':
      return date.getTime()

    case 'timestamp-seconds':
      return Math.floor(date.getTime() / 1000)

    case 'iso8601':
    default:
      return date.toISOString()
    }
  }

  _generateReviewBody(fields) {
    const table = [
      ['Field', 'Content'],
    ]

    Object.keys(fields).forEach((field) => {
      table.push([field, fields[field]])
    })

    return this.siteConfig.get('pullRequestBody') + markdownTable(table)
  }

  _resolvePlaceholders(subject, baseObject) {
    const matches = subject.match(/{(.*?)}/g)

    if (!matches) return subject

    matches.forEach((match) => {
      const escapedMatch = match.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
      const property = match.slice(1, -1)

      let newText

      switch (property) {
      case '@timestamp':
        newText = new Date().getTime()

        break

      case '@id':
        newText = this.uid

        break

      default:
        // eslint-disable-next-line no-case-declarations
        const timeIdentifier = '@date:'

        if (property.indexOf(timeIdentifier) === 0) {
          const timePattern = property.slice(timeIdentifier.length)

          newText = moment().format(timePattern)
        } else {
          newText = objectPath.get(baseObject, property) || ''
        }
      }

      // eslint-disable-next-line no-param-reassign
      subject = subject.replace(new RegExp(escapedMatch, 'g'), newText)
    })

    return subject
  }

  _validateConfig(config) {
    if (!config) {
      return errorHandler('MISSING_CONFIG_BLOCK')
    }

    // (`format`, `path`, `filename`, `extension`: no longer used -- every comment goes in `comments.json`)
    const requiredFields = [
      'allowedFields',
      'branch',
    ]

    const missingFields = []

    // Checking for missing required fields
    requiredFields.forEach((requiredField) => {
      if (objectPath.get(config, requiredField) === undefined) {
        missingFields.push(requiredField)
      }
    })

    if (missingFields.length) {
      return errorHandler('MISSING_CONFIG_FIELDS', {
        data: missingFields,
      })
    }

    this.siteConfig = SiteConfig(config, this.rsa)

    return null
  }

  _validateFields(fields) {
    const missingRequiredFields = []
    const invalidFields = []

    Object.keys(fields).forEach((field) => {
      // Check for any invalid fields
      if ((this.siteConfig.get('allowedFields').indexOf(field) === -1) && (fields[field] !== '')) {
        invalidFields.push(field)
      }

      // Trim fields
      if (typeof fields[field] === 'string') {
        // eslint-disable-next-line no-param-reassign
        fields[field] = fields[field].trim()
      }
    })

    // Check for missing required fields
    this.siteConfig.get('requiredFields').forEach((field) => {
      if ((fields[field] === undefined) || (fields[field] === '')) {
        missingRequiredFields.push(field)
      }
    })

    if (missingRequiredFields.length) {
      return errorHandler('MISSING_REQUIRED_FIELDS', {
        data: missingRequiredFields,
      })
    }

    if (invalidFields.length) {
      return errorHandler('INVALID_FIELDS', {
        data: invalidFields,
      })
    }

    return null
  }

  decrypt(encrypted) {
    return this.rsa.decrypt(encrypted, 'utf8')
  }

  getParameters() {
    return this.parameters
  }

  getSiteConfig(force) {
    if (this.siteConfig && !force) return Promise.resolve(this.siteConfig)

    if (!this.configPath) return Promise.reject(errorHandler('NO_CONFIG_PATH'))

    return this.git.readFile(this.configPath.file).then((data) => {
      const config = objectPath.get(data, this.configPath.path)
      const validationErrors = this._validateConfig(config)

      if (validationErrors) {
        return Promise.reject(validationErrors)
      }

      if (config.branch !== this.parameters.branch) {
        return Promise.reject(errorHandler('BRANCH_MISMATCH'))
      }

      return this.siteConfig
    })
  }

  processEntry(fields, options) {
    this.fields = { ...fields }
    this.options = { ...options }

    // (no emails in netlify's logs)
    log({ fields: { ...fields, email: fields.email ? '[redacted]' : undefined }, options })
    this.setConfigPath()

    return this.getSiteConfig().then((/* _fields */) => {
      // Validate fields
      const fieldErrors = this._validateFields(fields)
      log({ fieldErrors })
      if (fieldErrors) return Promise.reject(fieldErrors)

      // Add generated fields
      // eslint-disable-next-line no-param-reassign
      fields = this._applyGeneratedFields(fields)

      // Swap email for a private identity (& find any Gravatar)
      return this._applyAvatar(fields)
    }).then((avatarFields) => {
      // Apply transforms
      return this._applyTransforms(avatarFields)
    // eslint-disable-next-line newline-per-chained-call
    }).then((transformedFields) => {
      const commitMessage = this._resolvePlaceholders(this.siteConfig.get('commitMessage'), {
        fields,
        options,
      })

      const newBranch = `staticman_${this.uid}`

      // Add the comment to the site's one comments file (see `comments_file.js`)
      const comment = this._comment(transformedFields)
      return this.git.writeFileAndSendReview(
        CommentsFile.FILE,
        (text) => CommentsFile.insert(text, comment),
        newBranch,
        commitMessage,
        this._generateReviewBody(fields),
        this.avatar_file ? [this.avatar_file] : [],
      )
    // eslint-disable-next-line arrow-body-style, newline-per-chained-call
    }).then((/* _result */) => {
      return {
        fields,
        redirect: options.redirect ? options.redirect : false,
      }
    // eslint-disable-next-line newline-per-chained-call, arrow-body-style
    }).catch((err) => {
      return Promise.reject(errorHandler('ERROR_PROCESSING_ENTRY', {
        err,
        instance: this,
      }))
    })
  }

  processMerge(fields, options) {
    this.fields = { ...fields }
    this.options = { ...options }

    return this.getSiteConfig().then((/* _config */) => true).catch((err) => Promise.reject(errorHandler('ERROR_PROCESSING_MERGE', {
      err,
      instance: this,
    })))
  }

  setConfigPath(configPath) {
    // Default config path
    if (!configPath) {
      this.configPath = {
        file: 'staticman.yml',
        path: this.parameters.property || '',
      }

      return
    }

    this.configPath = configPath
  }
}

export default Staticman
