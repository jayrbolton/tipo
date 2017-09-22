const acorn = require('acorn')
const walk = require('acorn/dist/walk')
const path = require('path')
const fs = require('fs')
const visitors = require('../lib/visitors')

module.exports = (filepath, typeset, cb) => {
  filepath = path.resolve(filepath)
  const contents = fs.readFile(filepath, 'utf8', (err, contents) => {
    if (err) return cb(err)
    const parsed = acorn.parse(contents, {locations: true})
    const state = {types: typeset, errs: []}
    walk.recursive(parsed, state, visitors, walk.base)
    cb(state)
  })
}
