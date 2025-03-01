import convict from 'convict'

const schema = {
  allowedFields: {
    doc: 'An array with the names of the allowed fields. If any of the fields sent is not part of this list, the entry will be discarded and an error will be thrown.',
    docExample: 'allowedFields: ["name", "email", "message"]',
    format: Array,
    default: [],
  },
  branch: {
    doc: 'Name of the branch being used within the GitHub repository.',
    format: String,
    default: 'main',
  },
  commitMessage: {
    doc: 'Text to be used as the commit message when pushing entries to the GitHub repository.',
    format: String,
    default: 'Add Staticman data',
  },
  extension: {
    doc: 'The extension to be used in the generated data files (defaults to the extension associated with the `format` field)',
    format: String,
    default: '',
  },
  filename: {
    doc: 'Name for the data files being uploaded to the repository. You can use placeholders (denoted by curly braces), which will be dynamically replaced with the content of a field (e.g. `{fields.name}`), the content of an option (e.g. `{options.slug}`) or other dynamic placeholders such as the entry\'s unique id (`{@id}`).',
    format: String,
    default: '',
  },
  format: {
    doc: "Format of the data files being uploaded to the repository.  One of: ['yaml', 'yml', 'json', 'frontmatter']",
    format: String,
    default: 'yml',
  },
  generatedFields: {
    doc: 'List of fields to be appended to entries automatically. It consists of an object where keys correspond to the names of the fields being created and values being of mixed type. If values are objects, Staticman will look for a `type` and `options` keys inside and perform different operations based on their type; otherwise, the value will be used directly as the content of the generated field.',
    docExample: 'generatedFields:\n  someField: "some string" # Simple field (string)\n  date: # Extended field (date)\n    type: date\n    options:\n      format: "timestamp-seconds"',
    format: Object,
    default: {},
  },
  moderation: {
    doc: 'When set to `true`, a pull request with the data files will be created to allow site administrators to approve or reject an entry. Otherwise, entries will be pushed to `branch` immediately.',
    format: Boolean,
    default: true,
  },
  name: {
    doc: 'Human-friendly name of the property/website. This is used in notification emails.',
    docExample: 'name: "My awesome blog"',
    format: String,
    default: '',
  },
  path: {
    doc: 'Path to the directory where entry files are stored. You can use placeholders (denoted by curly braces), which will be dynamically replaced with the content of a field (e.g. `{fields.name}`), the content of an option (e.g. `{options.slug}`) or other dynamic placeholders such as the entry\'s unique id (`{@id}`).',
    format: String,
    default: '_data/results/{@timestamp}',
  },
  pullRequestBody: {
    doc: 'Text to be used as the pull request body when pushing moderated entries.',
    format: String,
    default: 'Dear human,\n\nHere\'s a new entry for your approval. :tada:\n\nMerge the pull request to accept it, or close it to send it away.\n\n:heart: Your friend [Staticman](https://staticman.net) :muscle:\n\n---\n',
  },
  requiredFields: {
    doc: 'An array with the names of the fields that must be supplies as part of an entry. If any of these is not present, the entry will be discarded and an error will be thrown.',
    format: Array,
    default: [],
  },
  transforms: {
    doc: 'List of transformations to be applied to any of the fields supplied. It consists of an object where keys correspond to the names of the fields being transformed. The value determines the type of transformation being applied.',
    docExample: 'transforms:\n  email: "md5" # The email field will be MD5-hashed',
    format: Object,
    default: {},
  },
}

export { schema }
export default function load_config(data, rsa) {
  convict.addFormat({
    name: 'EncryptedString',
    validate: () => true,
    coerce: (val) => rsa.decrypt(val, 'utf8'),
  })

  const config = convict(schema)
  config.load(data)
  config.validate()

  return config
}
