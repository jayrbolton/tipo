//npm
const fs = require('fs')
const R = require('ramda')
const acorn = require('acorn')
const walk = require('acorn/dist/walk')
//local
const printType = require('./lib/print-type')
const TypeMatchError = require('./lib/errors/type-match-error')
const matchTypes = require("./lib/match-types")
const isTvar = require("./lib/is-tvar")
const createType = require("./lib/create-type")
const parseType = require('./lib/parse-type')

// Print an array of error messages into something readable-ish
const printErrs = R.compose(
  R.join("\n")
, R.map(err => `Type error [${err.node.start}:${err.node.end}]: ${err.message}`)
)

// All builtin types yikes!
const defaultBindings = {
  module: createType('Object', [{exports: 'a'}])
, require: createType('Function', [['String'], 'a'])
}

// Create a state object
const createState = () => {
  return {
    bindings: defaultBindings // A mapping of variable names to Types that we have discovered/inferred
  , errors: [] // Any type errors that we find on the journey
  , meta: {tvar: 'a'} // Misc metadata to be used as we traverse the AST to keep track of stuff
  , aliases: {} // Type aliases, eg "Human = Object({name: String, age: Number})"
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

const getFunctionType = (node, state, c) => {
  // Function assignment and definition
  const funcBindings = R.clone(state.bindings)
  const funcState = R.merge(state, {bindings: funcBindings, meta: {body: node.body, tvar: 'a', params: []}})
  R.map(bindParam(funcState), node.params)
  c(node.body, funcState)
  if(funcState.errors.length) {
    state.errors = state.errors.concat(funcState.errors)
    return
  }
  const paramTypes = R.map(name => funcState.bindings[name], funcState.meta.params)
  const returnType = funcState.bindings.return
  return createType("Function", [paramTypes, returnType], funcState)
}


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
    if(typeof node.value === 'string' && node.value.indexOf("&&&&") !== -1) {
      // This is a type declaration from a comment/string
      const text = node.value
      const [whole, lhs, operator, rhs] = text.match(/^(.+?)(=|:)(.+)$/)
      if(!lhs || !rhs || !operator || (operator !== '=' && operator !== ':')) {
        throw new SyntaxError(`Invalid type signature syntax in ${text}`)
      }
      const ident = lhs.replace('&&&&', '').trim()
      const type = parseType(rhs.trim())
      if(operator === ':') {
        state.bindings[ident] = state.aliases[type] || type
      } else if(operator === '=') {
        state.aliases[ident] = type
      }
      return
    }
    // A primitive value; always inferable
    state.meta.currentType = getLiteralType(node)
  }

, VariableDeclarator: (node, state, c) => {
    const name = node.id.name
    if(!node.init) {
      return
    }
    // Variable assignment
    const rtype = getType(node.init, state, c)
    if(state.bindings[name]) {
      state.bindings[name] = matchTypes(node, rtype, state.bindings[name])
    } else {
      state.bindings[name] = rtype
    }
  }

, FunctionExpression: (node, state, c) => {
    const type = getFunctionType(node, state, c)
    state.meta.currentType = type
  }

, FunctionDeclaration: (node, state, c) => {
    const funcType = getFunctionType(node, state, c)
    const existing = state.bindings[node.id.name]
    state.bindings[node.id.name] = existing ? matchTypes(node, existing, funcType) : funcType
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
      if(!node.arguments.length || node.arguments[0].type !== 'Literal' || !node.arguments[0].value) {
        throw new TypeMatchError("Invalid require; argument should be a string file-path", node)
        return
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
    // Functions must be defined in the current scope
    if(!funcType) {
      throw new TypeMatchError("Function call on undefined type", node)
      return
    } else if(funcType.name !== 'Function') {
      throw new TypeMatchError("Function call on a non-function type", node)
      return
    }
    // Get the types for each argument
    const argTypes = R.map(
      arg => getType(arg, state, c)
    , node.arguments
    )
    // const argBindings = R.fromPairs(R.zip(funcType.scope.meta.params, argTypes))
    // Create an array of pairs of [argumentType, paramType]
    // eg [['Number', 'a'], ['String', 'b']]
    const typePairs = R.zip(argTypes, funcType.params[0])
    // If any argument types do not match parameter types, throw an err
    const matched = R.map(R.apply(matchTypes(node)), typePairs)
    const matchedBindings = R.fromPairs(R.zip(funcType.scope.meta.params, matched))
    // Create a copy of the function-scoped state
    // so that we can bind the argument types to the params
    const typedScope = R.clone(funcType.scope)
    typedScope.bindings = R.merge(typedScope.bindings, matchedBindings)
    // Re-evaluate the function body using the parameter types bound to arg types
    c(funcType.scope.meta.body, typedScope)
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
        const tvar = incrTVar(state)
        state.meta.currentType = tvar
      } else if(ltype === 'Number' && rtype === 'Number') {
        state.meta.currentType = 'Number'
      } else {
        throw new TypeMatchError(`Invalid operand types for '+' operator: ${printType(ltype)} and ${printType(rtype)}`, node)
      }
    } else {
      // if(isTvar(ltype) && node.left.type === 'Identifier') {
     // }
      if((ltype === 'Number' || isTvar(ltype)) && (rtype === 'Number' || isTvar(rtype))) {
        state.meta.currentType = 'Number'
      } else {
        throw new TypeMatchError(`Operands for '${node.operator}' operator must be Numbers`, node)
      }
      if(isTvar(ltype) && node.left.type === 'Identifier') {
        state.bindings[node.left.name] = 'Number'
      }
      if(isTvar(rtype) && node.right.type === 'Identifier') {
        state.bindings[node.right.name] = 'Number'
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
    if(!objType) {
      throw new TypeMatchError(`Undefined object type for #{node.object.name}`, node)
      return
    }
    const prop = node.property.name

    // If we are referencing a property on a type variable,
    // infer that the type is actually an object with a property
    if(isTvar(objType)) {
      const tvar = incrTVar(state)
      state.bindings[node.object.name] = createType('Object', [{[node.property.name]: tvar}])
      state.meta.currentType = tvar
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
    if(node.operator === '+=' && (ltype !== 'Number' || rtype !== 'Number')) {
      // The only case where += returns a number type is if both ltype and rtype are Numbers
      // Otherwise, the result is always a String
      rtype = 'String'
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
      state.bindings[node.left.name] = matchTypes(node, rtype, existingType)
    } else {
      state.bindings[node.left.name] = rtype
    }
  }
}


const check = (program, bindings={}) => {
  var state = createState()
  state.bindings = R.merge(state.bindings, bindings)
  // onComment mutates state.bindings, adding bindings and type aliases from the comments
  const comments = []
  acorn.parse(program, {onComment: onComment(comments)})
  const replacedComments = R.reduce(
    (prog, [text, start, end]) => prog.substring(0, start) + text + prog.substring(end)
  , program
  , comments
  )
  const parsed = acorn.parse(replacedComments, {})
  walk.recursive(parsed, state, visitors, walk.base)
  return state
}

// replacing `//text` with `"text"` will always produce the same number of characters

const onComment = (array) => (block, text, start, end) => {
  if(!block && isTypeDec(text)) {
    text = text.replace('type', '&&&&')
    array.push([`"${text}"`, start, end])
  }
}

// Is the given a string a type declaration, like "type x : Number"
const isTypeDec = text => /^\s*type/.test(text)

module.exports = {check, printType, createType}
