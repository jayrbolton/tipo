const isTVar = require("./is-tvar")
const R = require('ramda')
const createType = require("./create-type")
const TypeMatchError = require('./errors/type-match-error')
const printType = require('./print-type')

// See if one type can match with another
// Returns Boolean
// (Number, a) -> Number
// (a, Number) -> Error
// (Array([Number]), Array([a])) -> Array([Number])
const matchTypes = R.curryN(3, (node, a, b) => {
  if(!a._isType && !b._isType) {
    if(isTVar(b) || a === b) return a
    if(isTVar(a)) return b
    // Match to arrays of types, pairwise
    if(R.is(Array, a) && R.is(Array, b)) {
      return R.map(R.apply(matchTypes(node)), R.zip(a, b))
    }
    // Match two plain type "objects", key-by-key
    if(R.is(Object, a) && R.is(Object, b)) {
      return R.reduce(
        (result, [key, val]) => R.assoc(key, matchTypes(node, val, b[key]), result)
      , {}
      , R.toPairs(a)
      )
    }
    else throw new TypeMatchError(`Unable to match type ${printType(a)} with ${printType(b)}`, node)
  }

  if(a.name !== b.name) {
    throw new TypeMatchError(`Unable to match type ${printType(a)} with ${printType(b)}`, node)
  }

  // For a type object with name and params, recursively match the param types
  const pairs = R.zip(a.params, b.params)
  return createType(a.name, R.map(R.apply(matchTypes(node)), pairs), R.merge(a.scope, b.scope))
})

module.exports = matchTypes
