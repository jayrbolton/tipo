const R = require('ramda')
const test = require('tape')
const tipo = require('../')
const TypeMatchError = require("../lib/errors/type-match-error")

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
test("integration of several basic inferences", function(t) {
  const program = `
    function hi(x) { 
      var hi = 'hi'
      return function(y) { 
        return y + x + hi
      }
    }
    var x = hi(1)(2)
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
test("it can infer anonymous function types", function(t) {
  const program = `var id = function(x) { return x }`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.id), "Function([a], a)")
  t.end()
})
test("it infers types of functions that return functions", function(t) {
  const program = `var fn = function(x) { return function() { return x}}`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.fn), "Function([a], Function([], a))")
  t.end()
})
test("it infers double calls on the same function", function(t) {
  const program = `var fn = function(x) { return function() { return x}}; var x = fn(1)()`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), "Number")
  t.end()
})
test("it allows for partial application", function(t) {
  const program = `var fn = function(x) { return function(){ return x }}; var fn1 = fn(1); var x = fn1()`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.fn1), "Function([], Number)")
  t.strictEqual(result.bindings.x, "Number")
  t.end()
})
test("it infers function within object properties", function(t) {
  const program = `var obj = {fn: function(x) { return x }}; obj.y = obj.fn(2)`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.obj), 'Object({fn: Function([a], a), y: Number})')
  t.end()
})
test("it assigns the types of variables whose types change", function(t) {
  const program = `var x = 1; x = 'hi'; x = 2`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), 'Any([Number, String])')
  t.end()
})
test("it infers ++ and --", function(t) {
  const program = `var x = 1; ++x; --x; x++; x--`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), "Number")
  t.end()
})
test("it infers += and -=", function(t) {
  const program = `var x = 1; x += 1; x -=1`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), "Number")
  t.end()
})
test("doing += with two object types yields a String type :p", function(t) {
  const program = `var x = {}; x += {}`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), "Any([Object({}), String])")
  t.end()
})
test.only("it infers types within conditionals", function(t) {
  const program = `
    var x 
    if(true) {
      var x = 2
    } else {
      var x = 'hi'
    }
  `
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), "Any([Number, String])")
  t.end()
})
/*
test.only("it infers for loops", function(t) { // TODO refine test name
  const program = `
    var x = 1
    for(var y = 0; ++y; y < 10) {
      x += "hi"
    }
  `
  const result = tipo.check(program)
  console.log(result)
  t.end()
})
*/
// TODO boolean operators ===, ==, <, >, etc
// TODO while loops
// TODO conditionals
// TODO prototypes, this, new, methods
// TODO nested type declarations inside lexical scopes (eg in functions)
// TODO builtin types!

// Inferences with type errors
test('it finds an error when a variable is assigned to an undefined variable', function(t) {
  var program = ` var x = y `
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("it finds an error for undefined function calls", function(t) {
  var program = `what('hi')`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("it finds an error when trying to call a non-function", function(t) {
  var program = `var x = 1; x(2)`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("it finds an error when calling a function with the wrong type argument", function(t) {
  const program = `var incr = function(n) { return n + 1 }; incr('hi')`
  const Incr = tipo.createType('Function', [['Number'], 'Number'])
  const bindings = {incr: Incr}
  const defaultState = tipo.createState()
  const state = R.merge(defaultState, {
    bindings: R.merge(defaultState.bindings, bindings)
  , types: R.merge(defaultState.types, {Incr})
  })
  t.throws(()=> tipo.checkWithState(program, state), TypeMatchError)
  t.end()
})
test("a var bound to an explicit object type throws an error when the var's type does not match the given type", function(t) {
  const Human = tipo.createType('Object', [{name: 'String', age: 'Number'}])
  const bindings = {x: Human}
  const defaultState = tipo.createState()
  const state = R.merge(defaultState, {
    bindings: R.merge(defaultState.bindings, bindings)
  , types: R.merge(defaultState.types, {Human})
  })
  const program = `var x = {name: 15, age: "finn"}`
  t.throws(()=> tipo.checkWithState(program, state), TypeMatchError)
  t.end()
})
test("Doing ++ on a string throws a type error", function(t) {
  const program = `var x = 'hi'; var y = ++x`
  t.throws(() => tipo.check(program), TypeMatchError)
  t.end()
})
test("cannot += on an undefined var", function(t) {
  const program = `x += 1`
  t.throws(() => tipo.check(program), TypeMatchError)
  t.end()
})
