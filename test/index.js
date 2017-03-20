const R = require('ramda')
const test = require('tape')
const tipo = require('../')
const TypeMatchError = require("../lib/errors/type-match-error")
require("./type-declarations")
require("./print-type")
require("./parse-type")
//TODO parse type tests

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
test("object inference on a parameter from a property reference", function(t) {
  const program = `function fn(x) { return x.prop }`
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.fn), "Function([Object({prop: b})], b)")
  t.end()
})
test("it infers binary operator results to be Number types", function(t) {
  const ops = ['/', '*', '-', '%', '**']
  ops.map(function(op) {
    const result = tipo.check(`var x = 1 ${op} 1`)
    t.strictEqual(result.bindings.x, 'Number')
  })
  t.end()
})
test("it infers tvars to be Number types when they are in the arguments of a Number binary operator", function(t) {
  const op = '/'
  const program = `function fn(x, y) { return x ${op} y}`
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.fn), "Function([Number, Number], Number)")
  t.end()
})
test("it infers null type", function(t) {
  const program = `var x = null`
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), "Null")
  t.end()
})
test("unary negation and plus", function(t) {
  const program = `var x = +(1-2); var y = -1`
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), "Number")
  t.deepEqual(tipo.printType(result.bindings.y), "Number")
  t.end()
})
test("unary plus with non-Numbers infers to Numbers", function(t) {
  const program = `let x = +true; let y = +'3'; let z = +null`
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), "Number")
  t.deepEqual(tipo.printType(result.bindings.y), "Number")
  t.deepEqual(tipo.printType(result.bindings.z), "Number")
  t.end()
})
test("it infers the type of a ternary conditional", function(t) {
  const program = `var x = true ? 1 : 2`
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), "Number")
  t.end()
})
test("it infers logical AND as the type of the operands", function(t) {
  const program = `var x = 1 && 2`
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), "Number")
  t.end()
})
test("it infers logical OR as the type of the operands", function(t) {
  const program = `const x = 'hi' && 'there'`
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), "String")
  t.end()
})
test("it handles for loops", function(t) {
  const program = `
    var x = 0
    for(var i = 0; i < 10; ++i) {
      ++x
    }
  `
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), 'Number')
  t.deepEqual(tipo.printType(result.bindings.i), 'Number')
  t.end()
})
test("it handles while loops", function(t) {
  const program = `
    var x = 0
    while(x < 10) {
      ++x
    }
  `
  const result = tipo.check(program)
  t.deepEqual(tipo.printType(result.bindings.x), 'Number')
  t.end()
})

// TODO strict/closed object types (no assignment, no extra properties)
// TODO strict/closed array types (only certain types allowed in the array)
// TODO parameterized type aliases
// TODO recursive type definitions
// TODO arrow functions
// TODO prefill types for all globals!!!
//     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
// TODO prototypes, this, new, methods
// TODO fix require relative path resolution
// TODO require on node_modules (can use require.resolve?)
// TODO cli util - crawl files in a directory and type-check all
//      browserify transform?
//      linting thing (look at how eslint and such are run)

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
  const program = `
    //type incr : Function([Number], Number)
    var incr = function(n) { return n + 1 }
    incr('hi')
  `
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("a var bound to an explicit object gets matched correctly", function(t) {
  const program = `
    //type x : Object({name: String, age: Number})
    var x = {name: "Finn", age: 16}
  `
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), 'Object({name: String, age: Number})')
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
test("it throws an error when assigning to an undeclared variable", function(t) {
  const program = `x = 1`
  t.throws(() => tipo.check(program), TypeMatchError)
  t.end()
})
test("Passing in an object with a property of the wrong type to a function that references that property throws a type error", function(t) {
  const program = `function fn(x) { return x.prop * 2 }; var x = fn({prop: 'hi'})`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("it throws an error when binary operator are given non-Number arguments", function(t) {
  const ops = ['/', '*', '-', '%', '**']
  ops.map(function(op) {
    t.throws(() => tipo.check(`var x = 1 ${op} 'hi'`), TypeMatchError)
  })
  t.end()
})
test("it throws a type error when you reassign the type of an existing variable", function(t) {
  const program = `var x = 1; x = 'hi'; x = 2`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("doing += with two object types throws a type error", function(t) {
  const program = `var x = {}; x += {}`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("it throws a type error when a variable is reassigned to different types in conditionals", function(t) {
  const program = `
    var x 
    if(true) {
      var x = 2
    } else {
      var x = 'hi'
    }
  `
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("a var bound to an explicit object type throws an error when the var's type does not match the given type", function(t) {
  const program = `
    //type x : Object({name: String, age: Number})
    var x = {name: 15, age: "finn"}
  `
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("it raises type error on unary negation with a non-number", function(t) {
  const program = `var x = -'hi'`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("it raises type error on unary addition with non-number, string, boolean, or null", function(t) {
  const program = `var x = +undefined`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("results in a ternary conditional must have the same type", function(t) {
  const program = `var x = true ? 1 : 'hi'`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("the operands in a binary logical AND expression must have the same type", function(t) {
  const program = `var y = null && undefined`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("the operands in a binary logical OR expression must have the same type", function(t) {
  const program = `var x = {} || []`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})


// The type of a type object is: Object({name: String, params: Array})
