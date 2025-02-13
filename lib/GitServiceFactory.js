
import GitHub from './GitHub.js'

const create = async (config, options) => new GitHub(config, options)

export { create }
export default create
