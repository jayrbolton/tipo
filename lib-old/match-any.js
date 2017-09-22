const R = require('ramda')
const matchTypes = require("./match-types")
const TypeMatchError = require('./errors/type-match-error')
const printType = require('./print-type')

const matchAny = R.curryN(3, (node, a, bs) => {
  const result = R.map(matchNoErr(node, a) , bs)
  if(!R.all(result)) {
    bTypes = R.map(printType, bs).join(", ")
    throw new TypeMatchError(`Unable to match type ${printType(a)} with any types in ${bTypes}`)
  } else {
    return result
  }
})

const matchNoErr = R.curryN(3, (node, a, b) => {
  try {
    return matchTypes(node, a, b)
  } catch(e) {
    return null
  }
})

module.exports = matchAny
