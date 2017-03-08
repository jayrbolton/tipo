function TypeMatchError(message, node) {
  this.name = 'TypeMatchError'
  this.message = `[${node.start}:${node.end}] ` + message
  this.node = node
  return this
}

module.exports = TypeMatchError
