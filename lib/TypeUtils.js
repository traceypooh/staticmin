
const assertString = (value, message = `${value} is not a string`) => {
  if (typeof value !== 'string') {
    throw new TypeError(message)
  }
}

// eslint-disable-next-line import/prefer-default-export
export { assertString }
