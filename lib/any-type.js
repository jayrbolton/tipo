const R = require('ramda')
const createType = require('./create-type')

module.exports = (types) => {
  return createType(
    "Any"
  , [
      R.flatten(R.map(
        t => t.name === 'Any' ? t.params : t
      , types
      ))
    ]
  )
}
