function TypeMatchError(message, node) {
  this.name = 'TypeMatchError'
  const line = `[${node.loc.start.line}:${node.loc.start.column} - ${node.loc.end.line}:${node.loc.end.column}]`
  this.message = line + ' ' + message
  this.node = node
  return this
}

module.exports = TypeMatchError
