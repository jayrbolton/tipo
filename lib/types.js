
// Deep equality check on all properties
const deepCheck = (t1, t2) => {
  for (let name in t1) {
    if (t2[name] === undefined) {
      throw new TypeError('Missing property: ' + name)
    } else if (typeof t1[name] === 'object' && t1[name] !== null) {
      t1[name].check(t2[name])
    } else {
      if (t1[name] !== t2[name]) {
        throw new TypeError('Mismatched types: ' + t1[name] + ' vs ' + t2[name])
      }
    }
  }
}

// For primitive types
const checkName = (name, t2) => {
  if (name !== t2.name) {
    throw new TypeError('Mismatched types: ' + name + ' vs ' + t2.name)
  }
}

// Check that a type matches any of the listed types
const anyCheck = (types, t) => {
  if (!Array.isArray(types)) {
    throw new TypeError('Pass in an array of types for the Any type')
  }
  for (let i = 0; i < types.length; ++i) {
    let toMatch = types[i]
    if (typeof toMatch.check !== 'function') {
      throw new TypeError('Pass in an array of types for the Any type')
    }
    try {
      return toMatch.check(t)
    } catch (e) { }
  }
  throw new TypeError(`Could not match any type: [${types.map(t => t.name)}] with ${t.name}`)
}

const primType = (name, value) => {
  return {
    name,
    value,
    check: (t2) => {
      if (t2.name !== name) {
        throw new TypeError('Mismatched types: ' + name + ' vs ' + t2.name)
      }
    }
  }
}

const types = {}
types.Num = () => primType('number')
types.Str = () => primType('string')
types.Null = () => primType('null')
types.Undef = () => primType('undefined')

// exact value match type
types.value = (v) => ({
  name: 'value',
  value: v,
  check: (t2) => {
    if (typeof v !== t2.name) {
      throw new TypeError(`Value type mismatch: ${typeof v} vs ${t2.name}`)
    }
    if (v !== t2.value) {
      throw new TypeError(`Should be an exact value: ${v} vs ${t2.value}`)
    }
  }
})

types.Obj = ps => {
  return {
    name: 'object',
    check: (t2) => {
      if (t2.name !== 'object') {
        throw new TypeError('Should be an object')
      }
      deepCheck(ps, t2.props)
    },
    props: ps
  }
}

types.Any = ts => {
  return {
    name: 'any',
    types: ts,
    check: (t2) => {
      return anyCheck(ts, t2)
    }
  }
}

var count = 0
types.Var = (tag) => {
  var id = count++
  const data = {name: 'variableType', id, tag}
  const check = (t2) => {
    // Variable type will match with any non-variable type
    if (t2.name !== 'variableType') {
      // Has already gotten bound to a type
      if (data.binding) {
        data.binding.check(t2)
        return t2
      } else {
        // Not yet bound to any type; bind it!
        data.binding = t2
        return t2
      }
    } else if (id !== t2.id) { 
      // Match variable with variable
      throw new TypeError('Mismatched type variables: ' + t1.varName + ' vs ' + t2.varName)
    }
  }
  data.check = check
  return data
}

const typeNames = () => {
  let names = []
  for (let name in types) {
    names.push(name)
  }
  return names
}

const createType = (obj) => {
  if (!obj.hasOwnProperty('name')) {
    throw new TypeError('A new type must have a name')
  }
  if (types[obj.name]) {
    throw new Error('Duplicate type name: ' + name)
  }
  if (!obj.hasOwnProperty('check')) {
    obj.check = checkName
  }
  return obj
}

types.Func = ({input, output}) => {
  if (!Array.isArray(input)) input = [input]
  return {
    name: 'function',
    input,
    output,
    check: (t2) => {
      if (t2.name !== 'function') {
        throw new TypeError('Should be a function')
      }
      if (input.length !== t2.input.length) {
        throw new TypeError('Mismatched parameter lengths: ' + input.length + ' vs ' + t2.input.length)
      }
      for (let i = 0; i < input.length; ++i) {
        input[i].check(t2.input[i])
      }
      output.check(t2.output)
      return output
    },
  }
}

const Arr = t => {
  // TODO
  name: 'array'
}

module.exports = {types, createType, typeNames}
