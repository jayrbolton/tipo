'use strict'
/* eslint no-eval: 0 */
// npm
const fs = require('fs')
const R = require('ramda')
const acorn = require('acorn')
const walk = require('acorn/dist/walk')
// local
const printType = require('./lib/print-type')
const TypeMatchError = require('./lib/errors/type-match-error')
const matchTypes = require('./lib/match-types')
const isTvar = require('./lib/is-tvar')
const createType = require('./lib/create-type')
// const parseType = require('./lib/parse-type')
const primitives = require('./lib/primitives')
const singletons = require('./lib/singletons')
// const checkType = require('./lib/checkType')

// builtin globals
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const defaultBindings = {
  module: createType('Object', [{exports: 'a'}]),
  require: createType('function', [['string'], 'a'])
}

const simpleTypes = primitives.concat(singletons)

// Create a state object
const createState = () => {
  return {
    bindings: defaultBindings, // A mapping of variable names to Types that we have discovered/inferred
    errors: [], // Any type errors that we find on the journey
    meta: {tvar: 'a'}, // Misc metadata to be used as we traverse the AST to keep track of stuff
    aliases: {} // Type aliases, eg 'Human = Object({name: string, age: number})'
  }
}

const getType = (node, state, visit) => {
  visit(node, state)
  const t = state.meta.currentType
  state.meta.currentType = undefined
  return t
}

// Get the type of a primitive literal value
const getLiteralType = (node) => {
  const v = node.value
  for (let i = 0; i < singletons.length; ++i) {
    if (v === singletons[i]) return String(singletons[i])
  }
  for (let i = 0; i < primitives.length; ++i) {
    const t = typeof v
    if (t === primitives[i]) return primitives[i]
  }
}

// Bind all parameters for a function definition to open types
// Save a special meta array of param types so we know what types are in what order
const bindParam = state => node => {
  // Bind an identifier to an open type variable if declared from the params
  const tvar = incrTVar(state)
  state.bindings[node.name] = tvar
  state.meta.params.push(node.name)
}

// For incrementing type variables, which are lowercase characters starting with 'a'
const incrTVar = state => {
  const tvar = state.meta.tvar
  state.meta.tvar = String.fromCharCode(tvar.charCodeAt() + 1)
  return tvar
}

const getFunctionType = (node, state, visit) => {
  // Function assignment and definition
  const funcBindings = R.clone(state.bindings)
  const funcState = R.merge(state, {
    bindings: funcBindings,
    meta: {
      body: node.body, tvar: 'a', params: []
    }
  })
  R.map(bindParam(funcState), node.params)
  visit(node.body, funcState)
  if (funcState.errors.length) {
    state.errors = state.errors.concat(funcState.errors)
    return
  }
  // XXX Maybe there is a better way to distinguish type vars from primitive types?
  const wrapQuotes = p => simpleTypes.indexOf(p) !== -1 ? '"' + p + '"' : p
  const paramTypes = R.map(name => funcState.bindings[name], funcState.meta.params)
    .map(wrapQuotes)
  var returnType = wrapQuotes(funcState.bindings.ret)
  const body = `return { type: 'function', input: [${paramTypes}], output: ${returnType} }`
  const args = paramTypes.concat([body])
  return Function.apply(Function, args)
}

// Our acorn dictionary of visitor functions for every type of node we want to type-check
const visitors = {
  Identifier: (node, state, c) => {
    // Variable names
    if (!state.bindings[node.name]) {
      // Identifiers must be defined in the scope
      throw new TypeMatchError(`Undefined identifier '${node.name}'`, node)
    }
    state.meta.currentType = state.bindings[node.name]
  },

  Literal: (node, state, c) => {
    // A literal value: always inferable
    state.meta.currentType = getLiteralType(node)
  },

  VariableDeclarator: (node, state, visit) => {
    // Declaring a new variable
    const name = node.id.name
    if (!node.init) {
      return // undefined declaration with no assignment
    }
    // Variable assignment
    const rtype = getType(node.init, state, visit)
    if (state.bindings[name]) {
      // We are re-assigning an existing variable; match old type with new
      state.bindings[name] = matchTypes(node, state.bindings[name], rtype)
    } else {
      state.bindings[name] = rtype
    }
  },

  FunctionExpression: (node, state, c) => {
    const type = getFunctionType(node, state, c)
    state.meta.currentType = type
  },

  FunctionDeclaration: (node, state, visit) => {
    const funcType = getFunctionType(node, state, visit)
    const existing = state.bindings[node.id.name]
    return existing || funcType
    // state.bindings[node.id.name] = (existing ? matchTypes(node, existing, funcType) : funcType)
  },

  ReturnStatement: (node, state, c) => {
    // Evaluate the return expression to get its type, which will be saved to state.meta.currentType
    state.meta.currentType = getType(node.argument, state, c)
    state.bindings.ret = state.meta.currentType
  },

  CallExpression: (node, state, c) => {
    // Function call
    if (node.callee.name === 'require') {
      // Load another file and check it
      if (!node.arguments.length || node.arguments[0].type !== 'Literal' || !node.arguments[0].value) {
        throw new TypeMatchError('Invalid require; argument should be a string file-path', node)
      }
      const path = require.resolve(node.arguments[0].value)
      const contents = fs.readFileSync(path, 'utf8')
      const result = check(contents)
      const exportType = result.bindings.module.params[0].exports
      state.meta.currentType = exportType
      return
    }
    // Infer the type of function being called
    const funcType = getType(node.callee, state, c)
    if (!funcType) {
      throw new TypeMatchError('Function call on undefined type', node)
    }
    // Get the types for each argument
    const argTypes = R.map(
      arg => getType(arg, state, c),
      node.arguments
    )

    // Function types are always functions that take type parameters
    // Instantiate the function type with the argument types
    const type = typeof funcType === 'function'
      ? funcType.apply(null, argTypes)
      : funcType

    // const argBindings = R.fromPairs(R.zip(funcType.scope.meta.params, argTypes))
    // Create an array of pairs of [argumentType, paramType]
    // eg [['number', 'a'], ['string', 'b']]
    const typePairs = R.zip(argTypes, type.input)
    console.log('pairs', typePairs)
    // If any argument types do not match parameter types, throw an err
    typePairs.map(([a, b]) => matchTypes(node, a, b))
    return type
    /*
    console.log('matched', matched)
    const matchedBindings = R.fromPairs(R.zip(type.scope.meta.params, matched))
    // Create a copy of the function-scoped state
    // so that we can bind the argument types to the params
    const typedScope = R.clone(type.scope)
    typedScope.bindings = R.merge(typedScope.bindings, matchedBindings)
    // Re-evaluate the function body using the parameter types bound to arg types
    c(type.scope.meta.body, typedScope)
    // Finally, the return type of the typedScode is now our currentType
    state.meta.currentType = typedScope.bindings.ret
    */
  },

  UnaryExpression: (node, state, c) => {
    const argType = getType(node.argument, state, c)
    if (node.operator === '-') {
      matchTypes(node, 'number', argType)
      state.meta.currentType = 'number'
    } else if (node.operator === '+') {
      state.meta.currentType = matchTypes(node, ['number', 'string', 'null', 'boolean'], argType)
    }
  },

  LogicalExpression: (node, state, c) => {
    const ltype = getType(node.left, state, c)
    const rtype = getType(node.right, state, c)
    matchTypes(node, ltype, rtype)
    state.meta.currentType = ltype
  },

  BinaryExpression: (node, state, c) => {
    const ltype = getType(node.left, state, c)
    const rtype = getType(node.right, state, c)
    if (node.operator === '+') {
      if (ltype === 'string' || rtype === 'string') {
        state.meta.currentType = 'string'
      } else if (isTvar(ltype) || isTvar(rtype)) {
        const tvar = incrTVar(state)
        state.meta.currentType = tvar
      } else if (ltype === 'number' && rtype === 'number') {
        state.meta.currentType = 'number'
      } else {
        throw new TypeMatchError(`Invalid operand types for '+' operator: ${printType(ltype)} and ${printType(rtype)}`, node)
      }
    } else {
      // if(isTvar(ltype) && node.left.type === 'Identifier') {
     // }
      if ((ltype === 'number' || isTvar(ltype)) && (rtype === 'number' || isTvar(rtype))) {
        state.meta.currentType = 'number'
      } else {
        throw new TypeMatchError(`Operands for '${node.operator}' operator must be number`, node)
      }
      if (isTvar(ltype) && node.left.type === 'Identifier') {
        state.bindings[node.left.name] = 'number'
      }
      if (isTvar(rtype) && node.right.type === 'Identifier') {
        state.bindings[node.right.name] = 'number'
      }
    }
  },

  ConditionalExpression: (node, state, c) => {
    // Node has keys for 'test', 'consequent', and 'alternate', where:
    //  test ? consequent : alternate
    const consType = getType(node.consequent, state, c)
    const altType = getType(node.alternate, state, c)
    matchTypes(node, consType, altType)
    state.meta.currentType = consType
  },

  UpdateExpression: (node, state, c) => {
    // Infer the type for a unary updater thing, like ++x, --x, x++, x--
    // Get the type of the argument
    const type = getType(node.argument, state, c)
    if ((node.operator === '++' || node.operator === '--') && type === 'number') {
      state.meta.currentType = 'number'
    } else {
      throw new TypeMatchError(`Invalid type for '${node.operator}' operator: ${type}. This should be a number`, node)
    }
  },

  ArrayExpression: (node, state, c) => {
    const elemTypes = R.map(
      elem => getType(elem, state, c)
    , node.elements
    )
    const type = createType('Array', [elemTypes])
    state.meta.currentType = type
  },

  ObjectExpression: (node, state, visit) => {
    let objType = {}
    for (let i = 0; i < node.properties.length; ++i) {
      let prop = node.properties[i]
      objType[prop.key.name] = getType(prop, state, visit)
    }
    state.meta.currentType = objType
  },

  MemberExpression: (node, state, c) => {
    const objType = state.bindings[node.object.name]
    if (!objType) {
      throw new TypeMatchError(`Undefined object type for #{node.object.name}`, node)
    }
    const prop = node.property.name

    // If we are referencing a property on a type variable,
    // infer that the type is actually an object with a property
    if (isTvar(objType)) {
      const tvar = incrTVar(state)
      state.bindings[node.object.name] = createType('Object', [{[node.property.name]: tvar}])
      state.meta.currentType = tvar
      return
    }

    if (objType.params[0] && objType.params[0][prop]) {
      const type = objType.params[0][prop]
      state.meta.currentType = type
    }
  },

  AssignmentExpression: (node, state, c) => {
    // Get type of right-hand expression
    // Get the type of the right side of the assignment
    var rtype = getType(node.right, state, c)
    const ltype = getType(node.left, state, c)
    // Handle non-regular, mutating assignment, like +=, -=, >>=, etc, etc
    if (node.operator === '+=' && (ltype !== 'number' || rtype !== 'number')) {
      // The only case where += returns a number type is if both ltype and rtype are number
      // Otherwise, the result is always a string
      rtype = 'string'
    }

    // Handle object property assignment specially
    if (node.left.type === 'MemberExpression') {
      // const objName = node.left.object.name
      const propName = node.left.property.name
      const objType = state.bindings[node.left.object.name]
      const param = objType.params[0]
      param[propName] = rtype
      return
    }
    if (!ltype) {
      throw new TypeMatchError('Assignment to undefined variable', node)
    }

    if (node.operator !== '=' && node.operator !== '+=' && (rtype !== 'number' || ltype !== 'number')) {
      // For all operators like -=, *=, /=, >>=, >>>=, ^=, etc, etc, both sides must be number
      throw new TypeMatchError(`For the operator ${node.operator}, both sides of the assignment must be type number`, node)
    }
    const existingType = state.bindings[node.left.name]
    if (existingType && existingType !== rtype) {
      state.bindings[node.left.name] = matchTypes(node, rtype, existingType)
    } else {
      state.bindings[node.left.name] = rtype
    }
  }
}

function check (program, typeCode = '') {
  const bindings = eval(typeCode)
  const state = createState()
  state.bindings = R.merge(state.bindings, bindings)
  acorn.parse(program, {})
  const parsed = acorn.parse(program, {locations: true})
  walk.recursive(parsed, state, visitors, walk.base)
  return state
}

module.exports = {check, printType, createType}
