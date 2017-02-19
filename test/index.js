var test = require('tape')
var tipo = require('../')

test('printType prints a type!', function(t) {
  const typ = tipo.printType({name: 'Xyz', params: ['Number', {name: 'Qqq', params: []}]})
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
 
// Inferences with type errors
test('it finds an error when a variable is assigned to an undefined variable', function(t) {
  var program = ` var x = y `
  var result = tipo.check(program)
  t.strictEqual(result.errors[0].message, 'Undefined variable')
  t.end()
})

