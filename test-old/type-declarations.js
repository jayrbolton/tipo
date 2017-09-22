const R = require('ramda')
const test = require('tape')
const tipo = require('../')
const TypeMatchError = require("../lib/errors/type-match-error")

test(" basic binding and aliasing of a function", function(t) {
  const program = `
    // type Add = function([number, number], number)
    // type add : Add
    var add = function(x, y) { return x + y }
    var x = add('hi', 'there')
  `
  t.throws(() => tipo.check(program), TypeMatchError)
  t.end()
})
test("comment experiments within require", function(t) {
  const program = `var add = require('./test/annotated'); add('hi', 'there')`
  t.throws(()=> tipo.check(program), TypeMatchError)
  t.end()
})
test("comment type aliasing", function(t) {
  const program = `
    // type Human = Object({name: string, age: number})
    // type x : Human
    var x = {name: "Bob", age: 12}
  `
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.x), 'Object({name: string, age: number})')
  t.end()
})
test("inner-lexical scope type declarations", function(t) {
  const program = `
    var x = 'Hi'
    function fn(x) {
      // type x : number
      // type y : number
      var y = x + 1
      return y
    }
  `
  const result = tipo.check(program)
  t.strictEqual(tipo.printType(result.bindings.fn), "function([number], number)")
  t.strictEqual(tipo.printType(result.bindings.x), "string")
  t.end()
})
