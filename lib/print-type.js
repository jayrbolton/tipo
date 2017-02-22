const R = require('ramda')

// format an object intoa  readable string
const printObj = obj =>
  R.compose(
    R.replace(/(.*)/, '{$1}')
  , R.join(", ")
  , R.map(([key, val]) => `${key}: ${printType(val)}`)
  , R.toPairs
  )(obj)

// Convert type to a string
const printType = (t) => {
  if(typeof t === 'string') return t
  if(t.length !== undefined) return '[' + R.join(', ', R.map(printType, t)) + ']'
  if(typeof t === 'object' && !t._isType) return printObj(t)
  const params = R.join(", ",  R.map(printType, t.params || []))
  return t.name + '(' + params + ')'
}

module.exports = printType
