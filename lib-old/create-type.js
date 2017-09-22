// Create a type object
const createType = (name, params, scope={}) => {
  return {
    name: name
  , params: params || []
  , _isType: true
  , scope // nested type state
  }
}

module.exports = createType
