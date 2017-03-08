const acorn = require('acorn')
const walk = require('acorn/dist/walk')
const R = require('ramda')
const createType = require('./create-type')

// The opposite of printType, this takes type signature syntax and turns it into a plain-JS object compatible with tipo

const getType = (node, c) => {
  var s = {}
  c(node, s)
  return s.type
}

const visitors = {
  Identifier: (node, state, c) => {
    state.type = node.name
  }
, ArrayExpression: (node, state, c) => {
    state.type = R.map(
      elem => getType(elem, c)
    , node.elements
    )
  }
, ObjectExpression: (node, state, c) => {
    state.type = R.reduce(
      (acc, prop) => R.assoc(prop.key.name, getType(prop, c), acc)
    , {}
    , node.properties
    )
  }
, CallExpression: (node, state, c) => {
    const argTypes = R.map(
      arg => getType(arg, c)
    , node.arguments
    )
    const name = node.callee.name
    if(!name) throw new Error
    state.type = createType(name, argTypes)
  }
}

const parse = (str) => {
  const parsed = acorn.parse(str)
  const state = {}
  walk.recursive(parsed, state, visitors, walk.base)
  return state.type
}

module.exports = parse
