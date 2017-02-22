const R = require('ramda')
const acorn = require('acorn')
const walk = require('acorn/dist/walk')
const fs = require('fs')
const printType = require('./lib/print-type')

// A type is an object with the format:
// {
//   name: TypeName
// , params: [[OtherType1, OtherType2], OtherType3]
// }

// Print an array of error messages into something readable-ish
const printErrs = R.compose(
  R.join("\n")
, R.map(err => `Type error [${err.node.start}:${err.node.end}]: ${err.message}`)
)

// Create a type object
const createType = (name, params) => {
  return {
    name: name
  , params: params || []
  , _isType: true
  }
}

// All builtin types yikes!
const defaultBindings = () => ({
  module: createType('Object', [{exports: createType('Object', ['a'])}])
, require: createType('Function', [['String'], 'a'])
})

// Create a state object
const createState = () => {
  return {
    bindings: defaultBindings() // A mapping of variable names to Types that we have discovered/inferred
  , scopes: {} // Nested lexical scopes, such as function bodies
  , errors: [] // Any type errors that we find on the journey
  , meta: {tvar: 'a'} // Misc metadata to be used as we traverse the AST to keep track of stuff
  }
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

// Bind a function call type's parameters and return type
const bindFunction = (node, state, funcState) => {
  const paramTypes = R.values(funcState.meta.paramBindings)
  const returnType = funcState.bindings.return
  state.bindings[node.id.name] = createType('Function', [paramTypes, returnType])
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

// Set the type of an Identifier node, depending on the context in which it is declared
const bindIdentifier = (node, state) => {
  const name = node.name
  if(state.meta.status === 'assigning') {
    // Bind an identifier to the value in an assignment
    if(state.bindings[name]) {
      // Assigning one variable to another
      state.bindings[state.meta.assignee] = state.bindings[name]
    } else {
      // Error assigning to an undefined variable
      state.errors.push({ message: "Undefined variable", node})
    }
  }
}

// See if type 'a' can match type 'b'
// Returns Boolean
// (Number, a) -> Number
// (a, Number) -> null
// (Array(Number), Array(a)) -> Array(Number)
const matchTypes = (a, b) => {
  if(isTvar(b) || a === b) return a
  if(a.name !== b.name) return null
  // TODO type match all params in a and all params in b, pair-wise
}

// Is it a type variable?
// Returns Boolean
const isTvar = (a) => typeof a === 'string' && /^[a-z]$/.test(a)
// For incrementing type variables, which are single alphabet letters
const nextChar = (c) => String.fromCharCode(c.charCodeAt() + 1)


// In the given bindings, replace all instances of type 'b' with type 'a'
// Mutates state
const replaceTypes = state => (a, b) => {
  var bindings = state.bindings
  for(const name in bindings) {
    const type = bindings[name]
    if(type === b) bindings[name] = a
  }
}


// Our acorn dictionary of visitor functions for every type of node we want to type-check
const visitors = {
  Identifier: (node, state, c) => {
    if(!state.bindings[node.name]) {
      // Identifiers must be defined
      state.errors.push({message: "Undefined variable" , node })
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
    c(node.init, state)
    state.bindings[node.id.name] = state.meta.currentType
    delete state.meta.currentType
    return node.type
  }

, FunctionDeclaration: (node, state, c) => {
    // Function assignment and definition
    const name = node.id.name
    var funcState = R.merge(createState(), {meta: {body: node.body, tvar: 'a', params: []}})
    state.scopes[name] = funcState
    // Bind all parameters to open types -- mutates funcState
    R.map(bindParam(funcState), node.params)
    // Traverse the function body with the scoped state
    c(node.body, funcState)
    if(funcState.errors.length) {
      state.errors = state.errors.concat(funcState.errors)
      return
    }
    state.bindings[name] = createType('Function', [funcState.meta.params, funcState.bindings.return])
  }

, ReturnStatement: (node, state, c) => {
    // Evaluate the return expression to get its type, which will be saved to state.meta.currentType
    c(node.argument, state)
    state.bindings.return = state.meta.currentType
    delete state.meta.currentType
  }

, CallExpression: (node, state, c) => {
    // Function call
    const name = node.callee.name
    if(name === 'require') {
      // TODO Load another file and check it
      const fileState = createState()
      if(!node.arguments.length || node.arguments[0].type !== 'Literal' || !node.arguments[0].value) {
        state.errors.push[{message: 'Invalid require; argument should be a string file-path', node}]
        return
      }
      const path = node.arguments[0].value
      const fullpath = /\.(js|json)$/.test(path) ? path : path + '.js'
      const contents = fs.readFileSync(fullpath, 'utf8')
      const result = checkWithState(contents, fileState)
      console.log({fileState})
      console.log({result})
      return
    }
    const type = state.bindings[name]
    // Functions must be defined in the current scope
    if(!type) {
      state.errors.push({message: "Undefined function", node})
      return
    }
    var scope = state.scopes[name]
    // Get the types for each argument
    var argTypes = []
    R.map(
      arg => {
        c(arg, state)
        argTypes.push(state.meta.currentType)
        delete state.meta.currentType
      }
    , node.arguments
    )
    // Create an array of pairs of [argumentType, paramType]
    // eg [['Number', 'a'], ['String', 'b']]
    const typePairs = R.zip(argTypes, scope.meta.params)
    // If any argument types do not match parameter types, push an err
    if(!R.all(R.map(R.apply(matchTypes), typePairs))) {
      state.errors.push({message: "Invalid function arguments", node})
      return
    }
    // Create a copy of the function-scoped state
    // so that we can bind the argument types to the params
    const typedScope = R.clone(scope)
    R.map(R.apply(replaceTypes(typedScope)), typePairs)
    // Re-evaluate the function body using the parameter types bound to arg types
    c(scope.meta.body, typedScope)
    // Finally, the return type of the typedScode is now our currentType
    state.meta.currentType = typedScope.bindings.return
    delete typedScope
  }

, BinaryExpression: (node, state, c) => {
    c(node.left, state)
    var leftType = state.meta.currentType
    delete state.meta.currentType
    c(node.right, state)
    var rightType = state.meta.currentType
    delete state.meta.currentType
    if(node.operator === '+') {
      if(leftType === 'String' || rightType === 'String') {
        state.meta.currentType = 'String'
      } else if(isTvar(leftType) || isTvar(rightType)) {
        state.meta.currentType = state.meta.tvar
        state.meta.tvar = nextChar(state.meta.tvar)
      } else if(leftType === 'Number' && rightType === 'Number') {
        state.meta.currentType = 'Number'
      } else {
        state.errors.push({node, message: 'Invalid types for "+" operator'})
      }
    }
  }

, ArrayExpression: (node, state, c) => {
    const elemTypes = []
    R.map(
      elem => {
        c(elem, state)
        elemTypes.push(state.meta.currentType)
        delete state.meta.currentType
      }
    , node.elements
    )
    const type = createType('Array', [elemTypes])
    state.meta.currentType = type
  }

, ObjectExpression: (node, state, c) => {
    const objTypes = {}
    R.map(
      prop => {
        c(prop, state)
        objTypes[prop.key.name] = state.meta.currentType
        delete state.meta.currentType
      }
    , node.properties
    )
    const type = createType('Object', [objTypes])
    state.meta.currentType = type
  }

, MemberExpression: (node, state, c) => {
    const objType = state.bindings[node.object.name]
    const prop = node.property.name
    if(!objType) {
      state.errors.push({ message: "Undefined object", node })
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
    c(node.right, state)
    const type = state.meta.currentType
    delete state.meta.currentType
    if(node.left.type === "MemberExpression") {
      const objName = node.left.object.name
      const propName = node.left.property.name
      const objType = state.bindings[node.left.object.name]
      const param = objType.params[0]
      param[propName] = type
    }
  }
}


const check = program => checkWithState(program, createState())

const checkWithState = (program, state) => {
  var parsed = acorn.parse(program, {})
  walk.recursive(parsed, state, visitors, walk.base)
  // console.log("Bindings: ", state.bindings)
  // console.log("Errors: ", state.errors)
  // console.log("Scopes: ", state.scopes)
  return state
}

module.exports = {check, printType, createType, printErrs}
