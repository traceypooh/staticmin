import md5 from 'https://esm.sh/md5@^2.1.0'

const upcase = (value) => {
  return String(value).toUpperCase()
}

const downcase = (value) => {
  return String(value).toLowerCase()
}

export { md5, upcase, downcase }
