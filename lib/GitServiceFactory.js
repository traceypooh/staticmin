
import GitHub from './GitHub.js'

const create = async (service, options) => new GitHub(options)

export { create }
export default create

