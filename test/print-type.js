const R = require('ramda')
const test = require('tape')
const tipo = require('../')
const TypeMatchError = require("../lib/errors/type-match-error")
require("./type-declarations")

test('printType prints a type!', function(t) {
  const typ = tipo.printType(tipo.createType('Xyz', ['Number', tipo.createType('Qqq', [])]))
  t.strictEqual(typ, 'Xyz(Number, Qqq())')
  t.end()
})
