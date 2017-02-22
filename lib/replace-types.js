

// In the given bindings, replace all instances of type 'b' with type 'a'
// Mutates state
const replaceTypes = bindings => (a, b) => {
  for(const name in bindings) {
    const type = bindings[name]
    if(type === b) bindings[name] = a
  }
}

module.exports = replaceTypes
