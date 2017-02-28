//npm
const R = require('ramda')
const acorn = require('acorn')
const walk = require('acorn/dist/walk')
const fs = require('fs')
//local
const printType = require('./lib/print-type')
const replaceTypes = require('./lib/replace-types')
const TypeMatchError = require('./lib/errors/type-match-error')
const matchTypes = require("./lib/match-types")
const isTvar = require("./lib/is-tvar")
const createType = require("./lib/create-type")

// Print an array of error messages into something readable-ish
const printErrs = R.compose(
  R.join("\n")
, R.map(err => `Type error [${err.node.start}:${err.node.end}]: ${err.message}`)
)

// All builtin types yikes!
const defaultBindings = {
  module: createType('Object', [{exports: createType('Object', ['a'])}])
, require: createType('Function', [['String'], 'a'])
}

// Create a state object
const createState = () => {
  return {
    bindings: Object.create(defaultBindings) // A mapping of variable names to Types that we have discovered/inferred
  , errors: [] // Any type errors that we find on the journey
  , meta: {tvar: 'a'} // Misc metadata to be used as we traverse the AST to keep track of stuff
  , types: {}
  }
}

const getType = (node, state, c) => {
  c(node, state)
  const t = state.meta.currentType 
  delete state.meta.currentType
  return t
}

// Get the type of a primitive literal value
const getLiteralType = (node) => {
  const v = node.value
  if(!isNaN(v)) {
    return 'Number'
  } else if(typeof v === 'string') {
    return 'String'
  }
}

// Bind all parameters for a function definition to open types
// Save a special meta array of param types so we know what types are in what order
const bindParam = state => node => {
  // Bind an identifier to an open type variable if declared from the params
  const tvar = state.meta.tvar
  state.meta.tvar = nextChar(state.meta.tvar)
  state.bindings[node.name] = tvar
  state.meta.params.push(tvar)
}

// For incrementing type variables, which are single alphabet letters
const nextChar = (c) => String.fromCharCode(c.charCodeAt() + 1)


// Our acorn dictionary of visitor functions for every type of node we want to type-check
const visitors = {
  Identifier: (node, state, c) => {
    if(!state.bindings[node.name]) {
      // Identifiers must be defined
      throw new TypeMatchError(`Undefined identifier '${node.name}'`, node)
      return
    }
    state.meta.currentType = state.bindings[node.name]
  }

, Literal: (node, state, c) => {
    // A primitive value; always inferable
    state.meta.currentType = getLiteralType(node)
    return node.type
  }

, VariableDeclarator: (node, state, c) => {
    // Variable assignment
    const rtype = getType(node.init, state, c)
    const name = node.id.name
    if(state.bindings[name]) {
      state.bindings[name] = matchTypes(node, state.bindings[node.id.name], rtype)
    } else {
      state.bindings[name] = rtype
    }
    return node.type
  }

, FunctionExpression: (node, state, c) => {
    // An anonymous function expression
    const funcBindings = Object.create(state.bindings)
    const funcState = R.merge(state, {bindings: funcBindings, meta: {body: node.body, tvar: 'a', params: []}})
    R.map(bindParam(funcState), node.params)
    c(node.body, funcState)
    if(funcState.errors.length) {
      state.errors = state.errors.concat(funcState.errors)
      return
    }
    state.meta.currentType = createType('Function', [funcState.meta.params, funcState.bindings.return], funcState)
  }

, FunctionDeclaration: (node, state, c) => {
    // Function assignment and definition
    const name = node.id.name
    const funcBindings = Object.create(state.bindings)
    const funcState = R.merge(state, {
      bindings: funcBindings
    , meta: {body: node.body, tvar: 'a', params: []}
    })
    // Bind all parameters to open types -- mutates funcState
    R.map(bindParam(funcState), node.params)
    // Traverse the function body with the scoped state
    c(node.body, funcState)
    if(funcState.errors.length) {
      state.errors = state.errors.concat(funcState.errors)
      return
    }
    state.bindings[name] = createType('Function', [funcState.meta.params, funcState.bindings.return], funcState)
  }

, ReturnStatement: (node, state, c) => {
    // Evaluate the return expression to get its type, which will be saved to state.meta.currentType
    state.meta.currentType = getType(node.argument, state, c)
    state.bindings.return = state.meta.currentType
  }

, CallExpression: (node, state, c) => {
    // Function call
    if(node.callee.name === 'require') {
      // Load another file and check it
      const fileState = createState()
      if(!node.arguments.length || node.arguments[0].type !== 'Literal' || !node.arguments[0].value) {
        throw new TypeMatchError("Invalid require; argument should be a string file-path", node)
        return
      }
      const path = node.arguments[0].value
      const fullpath = /\.(js|json)$/.test(path) ? path : path + '.js'
      const contents = fs.readFileSync(fullpath, 'utf8')
      const result = checkWithState(contents, fileState)
      const exportType = fileState.bindings.module.params[0].exports
      state.meta.currentType = exportType
      return
    }
    // Infer the type of function being called
    const type = getType(node.callee, state, c)
    // Functions must be defined in the current scope
    if(!type) {
      throw new TypeMatchError("Function call on undefined type", node)
      return
    } else if(type.name !== 'Function') {
      throw new TypeMatchError("Function call on a non-function type", node)
      return
    }
    // Get the types for each argument
    const argTypes = R.map(
      arg => getType(arg, state, c)
    , node.arguments
    )
    // Create an array of pairs of [argumentType, paramType]
    // eg [['Number', 'a'], ['String', 'b']]
    const typePairs = R.zip(argTypes, type.params[0])
    // If any argument types do not match parameter types, throw an err
    const matched = R.map(R.apply(matchTypes(node)), typePairs)
    // Create a copy of the function-scoped state
    // so that we can bind the argument types to the params
    const typedScope = R.clone(type.scope)
    R.map(R.apply(replaceTypes(typedScope.bindings)), typePairs)
    // Re-evaluate the function body using the parameter types bound to arg types
    c(type.scope.meta.body, typedScope)
    // Finally, the return type of the typedScode is now our currentType
    state.meta.currentType = typedScope.bindings.return
    delete typedScope
  }

, BinaryExpression: (node, state, c) => {
    const ltype = getType(node.left, state, c)
    const rtype = getType(node.right, state, c)
    if(node.operator === '+') {
      if(ltype === 'String' || rtype === 'String') {
        state.meta.currentType = 'String'
      } else if(isTvar(ltype) || isTvar(rtype)) {
        state.meta.currentType = state.meta.tvar
        state.meta.tvar = nextChar(state.meta.tvar)
      } else if(ltype === 'Number' && rtype === 'Number') {
        state.meta.currentType = 'Number'
      } else {
        throw new TypeMatchError("Invalid types for '+' operator", node)
      }
    }
  }

, UpdateExpression: (node, state, c) => {
    // Infer the type for a unary updater thing, like ++x, --x, x++, x--
    // Get the type of the argument
    const type = getType(node.argument, state, c)
    if((node.operator === '++' || node.operator === '--') && type === 'Number') {
      state.meta.currentType = 'Number'
    } else {
      throw new TypeMatchError(`Invalid type for '${node.operator}' operator: ${type}. This should be a Number`, node)
    }
  }

, ArrayExpression: (node, state, c) => {
    const elemTypes = R.map(
      elem => getType(elem, state, c)
    , node.elements
    )
    const type = createType('Array', [elemTypes])
    state.meta.currentType = type
  }

, ObjectExpression: (node, state, c) => {
    const objTypes = R.reduce(
      (acc, prop) => R.assoc(prop.key.name, getType(prop, state, c), acc)
    , {}
    , node.properties
    )
    const type = createType('Object', [objTypes])
    state.meta.currentType = type
  }

, MemberExpression: (node, state, c) => {
    const objType = state.bindings[node.object.name]
    const prop = node.property.name
    if(!objType) {
      throw new TypeMatchError("Undefined object", node)
      return
    }

    if(objType.params[0] && objType.params[0][prop]) {
      const type = objType.params[0][prop]
      state.meta.currentType = type
      return
    }
  }

, AssignmentExpression: (node, state, c) => {
    // Get type of right-hand expression
    // Get the type of the right side of the assignment
    var rtype = getType(node.right, state, c)
    const ltype = getType(node.left, state, c)
    // Handle non-regular, mutating assignment, like +=, -=, >>=, etc, etc
    if(node.operator === '+=' && ltype !== 'Number' || rtype !== 'Number') {
      // The only case where += returns a number type is if both ltype and rtype are Numbers
      rtype = 'String' // Eg if x = 1 and you do x += {x: 1}, the result is a String :p
    }

    // Handle object property assignment specially
    if(node.left.type === "MemberExpression") {
      const objName = node.left.object.name
      const propName = node.left.property.name
      const objType = state.bindings[node.left.object.name]
      const param = objType.params[0]
      param[propName] = rtype
      return
    } 
    if(!ltype) { 
      throw new TypeMatchError("Assignment to undefined variable", node)
      return
    }

    if(node.operator !== '=' && node.operator !== '+=' && (rtype !== 'Number' || ltype !== 'Number')) {
      // For all operators like -=, *=, /=, >>=, >>>=, ^=, etc, etc, both sides must be Numbers
      throw new TypeMatchError(`For the operator ${node.operator}, both sides of the assignment must be type Number`, node)
    }
    const existingType = state.bindings[node.left.name]
    if(existingType && existingType !== rtype) {
      const typeParams = existingType.name === 'Any'
        ? R.uniq(R.concat(existingType.params[0], [rtype]))
        : [existingType, rtype]
      state.bindings[node.left.name] = createType('Any', [typeParams])
    } else {
      state.bindings[node.left.name] = rtype
    }
  }
}


const check = program => checkWithState(program, createState())

const checkWithState = (program, state) => {
  const parsed = acorn.parse(program, {})
  walk.recursive(parsed, state, visitors, walk.base)
  // console.log(parsed.body[1])
  // console.log("Bindings: ", state.bindings)
  // console.log("Errors: ", state.errors)
  // console.log("Scopes: ", state.scopes)
  return state
}

const loadDeclarations = (str) => {
  const state = createState()
  // console.log({parsed})
}

module.exports = {check, printType, createType, printErrs, checkWithState, loadDeclarations, createState}
