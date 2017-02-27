// Is it a type variable?
// Returns Boolean
const isTvar = (a) => typeof a === 'string' && /^[a-z]$/.test(a)

module.exports = isTvar
