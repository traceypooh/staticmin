// https://github.com/bashlk/staticman-netlify-function/blob/master/functions/staticman/staticman.js

/* eslint-disable no-underscore-dangle */
import markdownTable from 'https://esm.sh/markdown-table@^1.0.0'
import moment from 'https://esm.sh/moment@^2.18.1'
import NodeRSA from 'https://esm.sh/node-rsa@^0.4.2'
import objectPath from 'https://esm.sh/object-path@^0.11.1'
import slugify from 'https://esm.sh/slug@^0.9.3'
import { v1 as uuidv1 } from 'https://esm.sh/uuid@^11.0.5'
import yaml from 'https://esm.sh/js-yaml@^3.10.0'

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

      // To avoid encoding / secret / transport / environment variable issues,
      // the RSA key's value can have substituted any [NEWLINE] character in the string to
      // [SPACE] characters. So now update the values to valid PEM format.
      const key = 'githubPrivateKey'
      const v = this.config.get(key)
      this.config.set(key, v?.trim()
        .replace(/  +/g, ' ')
        .replace(/ /g, '\n')
        .replace(/BEGIN\nRSA\nPRIVATE\nKEY-----\s*/, 'BEGIN RSA PRIVATE KEY-----\n')
        .replace(/\s*-----END\nRSA\nPRIVATE\nKEY-----/, '\n-----END RSA PRIVATE KEY-----'))

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

  _applyInternalFields(data) {
    const internalFields = {
      _id: this.uid,
    }

    // Inject parent, if present
    if (this.options.parent) {
      internalFields._parent = this.options.parent
    }

    return Object.assign(internalFields, data)
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

  _createFile(fields) {
    return new Promise((resolve, reject) => {
      switch (this.siteConfig.get('format').toLowerCase()) {
      case 'json':
        // eslint-disable-next-line no-promise-executor-return
        return resolve(JSON.stringify(fields))

      case 'yaml':
      case 'yml':
        try {
          const output = yaml.safeDump(fields)

          // eslint-disable-next-line no-promise-executor-return
          return resolve(output)
        } catch (err) {
          // eslint-disable-next-line no-promise-executor-return
          return reject(err)
        }

      case 'frontmatter':
        // eslint-disable-next-line no-case-declarations
        const transforms = this.siteConfig.get('transforms')

        // eslint-disable-next-line no-case-declarations
        const contentField = transforms && Object.keys(transforms).find((field) => transforms[field] === 'frontmatterContent')

        if (!contentField) {
          // eslint-disable-next-line no-promise-executor-return
          return reject(errorHandler('NO_FRONTMATTER_CONTENT_TRANSFORM'))
        }

        // eslint-disable-next-line no-case-declarations
        const content = fields[contentField]
        // eslint-disable-next-line no-case-declarations
        const attributeFields = { ...fields }

        delete attributeFields[contentField]

        try {
          const output = `---\n${yaml.safeDump(attributeFields)}---\n${content}\n`

          // eslint-disable-next-line no-promise-executor-return
          return resolve(output)
        } catch (err) {
          // eslint-disable-next-line no-promise-executor-return
          return reject(err)
        }

      default:
        // eslint-disable-next-line no-promise-executor-return
        return reject(errorHandler('INVALID_FORMAT'))
      }
    })
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

  _getNewFilePath(data) {
    const configFilename = this.siteConfig.get('filename')
    const filename = (configFilename && configFilename.length)
      ? this._resolvePlaceholders(configFilename, {
        fields: data,
        options: this.options,
      })
      : this.uid

    let path = this._resolvePlaceholders(this.siteConfig.get('path'), {
      fields: data,
      options: this.options,
    })

    // Remove trailing slash, if existing
    if (path.slice(-1) === '/') {
      path = path.slice(0, -1)
    }

    const extension = this.siteConfig.get('extension').length
      ? this.siteConfig.get('extension')
      : this._getExtensionForFormat(this.siteConfig.get('format'))

    return `${path}/${filename}.${extension}`
  }

  // eslint-disable-next-line class-methods-use-this, consistent-return
  _getExtensionForFormat(format) {
    // eslint-disable-next-line default-case
    switch (format.toLowerCase()) {
    case 'json':
      return 'json'

    case 'yaml':
    case 'yml':
      return 'yml'

    case 'frontmatter':
      return 'md'
    }
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

    const requiredFields = [
      'allowedFields',
      'branch',
      'format',
      'path',
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

    log({ fields, options })
    this.setConfigPath()

    return this.getSiteConfig().then((/* _fields */) => {
      // Validate fields
      const fieldErrors = this._validateFields(fields)
      log({ fieldErrors })
      if (fieldErrors) return Promise.reject(fieldErrors)

      // Add generated fields
      // eslint-disable-next-line no-param-reassign
      fields = this._applyGeneratedFields(fields)

      // Apply transforms
      return this._applyTransforms(fields)
    // eslint-disable-next-line arrow-body-style
    }).then((transformedFields) => {
      return this._applyInternalFields(transformedFields)
    // eslint-disable-next-line arrow-body-style
    }).then((extendedFields) => {
      // Create file
      return this._createFile(extendedFields)
    // eslint-disable-next-line newline-per-chained-call
    }).then((data) => {
      const filePath = this._getNewFilePath(fields)
      const commitMessage = this._resolvePlaceholders(this.siteConfig.get('commitMessage'), {
        fields,
        options,
      })

      const newBranch = `staticman_${this.uid}`

      return this.git.writeFileAndSendReview(
        filePath,
        data,
        newBranch,
        commitMessage,
        this._generateReviewBody(fields),
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

  setIp(ip) {
    this.ip = ip
  }

  setUserAgent(userAgent) {
    this.userAgent = userAgent
  }
}

export default Staticman
