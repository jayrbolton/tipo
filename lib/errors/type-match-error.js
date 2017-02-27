function TypeMatchError(message, node) {
  this.name = 'TypeMatchError'
  this.message = message
  this.node = node
  return this
}

module.exports = TypeMatchError
