// Given a type and a value, see if the value has any type errors for the given type
// eg. match('number', 'string') -> {error: 'should be a number'}
// eg. match('number', 'number') -> {error: null}

module.exports = function match (type, val) {
  return matchRec(type, val, val)
}

function matchRec (type, val, whole) {
  // Functions are lazy types
  if (typeof type === 'function') {
    type = type()
  }
  // Arrays are union types
  if (Array.isArray(type)) {
    for (let i = 0; i < type.length; ++i) {
      const result = matchRec(type[i], val, whole)
      if (!result.error) return result
    }
    return {error: 'cannot match union type', type, val, whole}
  }
  // Objects are record types
  else if (typeof type === 'object' && type !== null) {
    if (typeof val !== 'object' || val === null) {
      return {error: 'cannot match object type', type, val, whole}
    } else {
      for (let prop in type) {
        if (!val.hasOwnProperty(prop)) {
          return {error: `missing field .${prop}`, type, val, whole}
        } else {
          const result = matchRec(type[prop], val[prop], whole)
          if (result.error) return result
        }
      }
      return {error: null}
    }
  } 
  if (typeof type === 'string') {
    const primitives = ['number', 'string', 'boolean']
    for (let i = 0; i < primitives.length; ++i) {
      if (type === primitives[i] && typeof val !== primitivies[i]) {
        return {error: 'should be a ' + primitivies[i], type, val, whole}
      }
    }
    const singletons = [null, undefined, NaN, Infinity]
    for (let i = 0; i < singletons.length; ++i) {
      if (type === String(singletons[i]) && val !== singletons[i]) {
        return {error: 'should be ' + String(singletons[i]), type, val, whole}
      }
    }
  }
  return {error: null}
}
