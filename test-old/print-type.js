const R = require('ramda')
const test = require('tape')
const tipo = require('../')
const TypeMatchError = require("../lib/errors/type-match-error")

test('printType prints a type!', function(t) {
  const typ = tipo.printType(tipo.createType('Xyz', ['number', tipo.createType('Qqq', [])]))
  t.strictEqual(typ, 'Xyz(number, Qqq())')
  t.end()
})
