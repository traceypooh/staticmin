import path from 'https://esm.archive.org/path'
import NodeRSA from 'npm:node-rsa'

import config from '../config.js'

const key = new NodeRSA()

key.importKey(config.get('rsaPrivateKey'), 'private')

const encrypt = (text) => {
  try {
    const encryptedText = key.encrypt(text, 'base64')

    return encryptedText
  } catch (err) {
    return null
  }
}

const decrypt = (text) => {
  try {
    return key.decrypt(text, 'utf8')
  } catch (err) {
    return null
  }
}

export { encrypt, decrypt }
