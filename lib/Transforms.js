import md5 from 'npm:md5'

const upcase = (value) => {
  return String(value).toUpperCase()
}

const downcase = (value) => {
  return String(value).toLowerCase()
}

export { md5, upcase, downcase }
