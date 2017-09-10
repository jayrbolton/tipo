const isTVar = require("./is-tvar")
const R = require('ramda')
const TypeMatchError = require('./errors/type-match-error')
const printType = require('./print-type')
const primitives = require('./primitives')
const singletons = require('./singletons')

// See if one type can match with another
// See if type `a` matches with type `b`
// Returns Boolean
// (Number, a) -> Number
// (a, Number) -> Error
// (Array([Number]), Array([a])) -> Array([Number])
const matchTypes = R.curry((node, a, b) => {
  // Arrays are union types
  if (Array.isArray(a)) {
    var type = b
    for (let i = 0; i < a.length; ++i) {
      try {
        return matchTypes(node, a[i], b)
      } catch (err) {
        e = err
      }
    }
    throw new TypeMatchError(`Cannot match union type ${printType(a)} with ${printType(b)}`, node)
  }
  // Objects are record types
  else if (typeof a === 'object' && a !== null) {
    if (typeof b !== 'object' || b === null) {
      throw new TypeMatchError(`Unable to match ${printType(a)} with ${printType(b)}`, node)
    } else {
      const resultType = {}
      for (let prop in a) {
        if (!b.hasOwnProperty(prop)) {
          throw new TypeMatchError(`Missing field '${prop}' in type ${b} (should match type ${a})`, node)
        } else {
          resultType[prop] = matchTypes(node, a[prop], b[prop])
        }
      }
      return resultType
    }
  }
  // Not an object or array; it must be a typevar or a primitive
  const simpleTypes = primitives.concat(singletons)
  for (let i = 0; i < simpleTypes.length; ++i) {
    const t = String(simpleTypes[i])
    if (a === t) {
      if (b === a) {
        return a
      } else {
        throw new TypeMatchError(`Unable to match ${a} with ${b}`, node)
      }
    }
  }
  // It must be a type var
  return b
})

module.exports = matchTypes
