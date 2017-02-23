const R = require('ramda')
var test = require('tape')
var tipo = require('../')

test('printType prints a type!', function(t) {
  const typ = tipo.printType(tipo.createType('Xyz', ['Number', tipo.createType('Qqq', [])]))
  t.strictEqual(typ, 'Xyz(Number, Qqq())')
  t.end()
})
// Inference on correct programs
test('it infers the type of a variable assignment to Number', function(t) {
  var program = ` var x = 1 `
  var result = tipo.check(program)
  t.strictEqual(result.bindings.x, 'Number')
  t.end()
})
test('it infers the type of a variable assignment to String', function(t) {
  var program = ` var x = "hi there friendo" ; 1 ; 2; 3`
  var result = tipo.check(program)
  t.strictEqual(result.bindings.x, 'String')
  t.end()
})
test('it infers the type of the identity function', function(t) {
  var program = `function id(x) { return x }`
  var result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.id), 'Function([a], a)')
  t.end()
})
test('it allows you to use types from the surrounding lexical scope from within a function', function(t) {
  var program = `var y = 'hi'; function fn(x) { return x + y } ; var z = fn(1)`
  var result = tipo.check(program)
  console.log(result.errors)
  t.strictEqual(tipo.printType(result.bindings.z), 'String')
  t.end()
})
test('it infers an identity function call', function(t) {
  var program = `function id(x) { return x }; var x = id(1)`
  var result = tipo.check(program)
  t.strictEqual(result.bindings.x, 'Number')
  var program2 = `function id(x) { return x }; var x = id("strrring")`
  var result2 = tipo.check(program2)
  t.strictEqual(result2.bindings.x, 'String')
  t.end()
})
test('it infers addition operation', function(t) {
  var program = `var x = 2; var y = 1 + x`
  var result = tipo.check(program)
  t.strictEqual(result.bindings.y, 'Number')
  t.end()
})
test('it infers func def + assignment + operator', function(t) {
  var program = `function id(x) { return x }; var x = id(3) + id("hi") + 1`
  var result = tipo.check(program)
  t.strictEqual(result.bindings.x, 'String')
  t.end()
})
test("it infers stuff within a function", function(t) {
  const program = `
    function hi(x) { 
      var hi = 'hi'
      return 1 + x + hi
    }
    var x = hi(1)
  `
  var result = tipo.check(program)
  t.strictEqual(result.bindings.x, 'String')
  t.end()
})
test("it infers array types", function(t) {
  const program = `var arr = [1,2,3 + 5]`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.arr), 'Array([Number, Number, Number])')
  t.end()
})
test("it infers object types", function(t) {
  const program = `var obj = {x: 1, y: 2}`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.obj), 'Object({x: Number, y: Number})')
  t.end()
})
test('it infers nested objs', function(t) {
  const program = `var obj = {x: 1, y: {z: [1,2]}}`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.obj), 'Object({x: Number, y: Object({z: Array([Number, Number])})})')
  t.end()
})
test("it infers object properties", function(t) {
  const program = `var obj = {x: 1}; var x = obj.x`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), 'Number')
  t.end()
})
test("it infers object assignment", function(t) {
  const program = `var obj = {}; obj.x = 1`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.obj), 'Object({x: Number})')
  t.end()
})
test("it parses require statements", function(t) {
  const program = `var x = require('./test/wut.js')`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), 'String')
  t.end()
})
test("it allows you to set types explicitly", function(t) {
  const Human = tipo.createType('Human', [{name: 'String', age: 'Number'}])
  const binding = {x: Human}
  const defaultState = tipo.createState()
  const state = R.merge(defaultState, {
    bindings: R.merge(defaultState.bindings, binding)
  , types: R.merge(defaultState.types, {Human})
  })
  const program = `var x = {name: 15, age: "finn"}`
  const result = tipo.checkWithState(program, state)
  t.strictEqual(result.errors[0].message, "Type Object({name: Number, age: String}) does not match Human({name: String, age: Number})")
  t.end()
})

// Inferences with type errors
test('it finds an error when a variable is assigned to an undefined variable', function(t) {
  var program = ` var x = y `
  var result = tipo.check(program)
  t.strictEqual(result.errors[0].message, 'Undefined variable')
  t.end()
})
test("it finds an error for undefined function calls", function(t) {
  var program = `what('hi')`
  var result = tipo.check(program)
  t.strictEqual(result.errors[0].message, 'Undefined function')
  t.end()
})
 
