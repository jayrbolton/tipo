const {types} = require('./types')

module.exports = {
  Identifier: (node, state, c) => {
    state.currentType = state.types[node.name]
    if (!state.currentType) {
      // state.currentType = x // TODO new tvar
    }
  },

  Literal: (node, state, c) => {
    if (typeof node.value === 'number') {
      state.currentType = types.Num()
    } else if (typeof node.value === 'string') {
      state.currentType = types.Str()
    } else if (node.value === null) {
      state.currentType = types.Null()
    } else if (node.value === undefined) {
      state.currentType = types.Undef()
    }
    state.currentType.value = node.value
  },

  FunctionExpression: (node, state, c) => {
    // TODO -- similar to ArrowFunctionExpression
  },

  ArrowFunctionExpression: (node, state, visit) => {
    const params = node.params.map(p => p.name)
    const paramTypes = {}
    if (state.currentAssignType) {
      params.map((p, idx) => {
        paramTypes[p] = state.currentAssignType.input[idx]
      })
    }
    const scopedState = {types: Object.assign(paramTypes, state.types)}
    visit(node.body, scopedState)
    if (state.currentAssignType) {
      state.currentAssignType.output.check(scopedState.currentType)
    }
  },

  CallExpression: (node, state, visit) => {
    state.currentType = null
    console.log(state.types.node.output)
    visit(node.callee, state)
    if (state.currentType === null) {
      throw new TypeError('Function call on undefined type')
    }
    const prevFuncType = state.currentType
    const funcType = Object.assign({}, state.currentType)
    let argTypes = []
    node.arguments.map(arg => {
      visit(arg, state)
      argTypes.push(state.currentType)
    })
    // type-check all the arg types against the stored param types
    argTypes = argTypes.map((argType, idx) => funcType.input[idx].check(argType))
    funcType.input = argTypes
    console.log('funcType', prevFuncType.input)
    // get the types for each argument
  },

  FunctionDeclaration: (node, state, visit) => {
    const params = node.params.map(p => p.name)
    state.types = {}
    for (let i = 0; i < params.length; ++i) {
      if (!state.paramTypes[i]) throw new TypeError('Mismatched parameters')
      state.types[params[i]] = state.paramTypes[i]
    }
    // create an object where the keys are the param names and the vals are the types
    visit(node.body, state)
  },

  BinaryExpression: (node, state, visit) => {
    visit(node.left, state)
    const tleft = state.currentType
    visit(node.right, state)
    const tright = state.currentType
    if (node.operator === '+') {
      if (tleft.name === 'number' && tright.name === 'number') {
        state.currentType = types.Num
      } else if (tleft.name === 'string' || tright.name === 'string') {
        state.currentType = types.Str
      } else {
        throw new TypeError('Invalid types in "+" operator: ' + tleft + ' and ' + tright)
      }
    }
  },

  ObjectExpression: (node, state, visit) => {
    let props = {}
    for (let i = 0; i < node.properties.length; ++i) {
      let prop = node.properties[i]
      let propName = prop.key.name
      visit(prop.value, state)
      props[propName] = state.currentType
    }
    state.currentType = types.Obj(props)
  },

  VariableDeclarator: (node, state, visit) => {
    const id = node.id.name
    state.currentAssignType = state.types[id]
    visit(node.init, state)
    const inferredType = state.currentType
  },
}
