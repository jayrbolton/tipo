# tipo

This is a work-in-progress that intends to add a type system to plain JS programs without touching the language itself, using type inference. Explicit type expressions can be added into specially-demarcated comments. It is intended to help check program correctness, increase maintainability, and generate documentation. It is strictly an add-on static analyzer (no need to transpile anything or modify the language itself).

Current status: 
- Most of basic es2015 has working type inference.
- Type annotation in comments is implemented

### type language

Tipo has a type signature language that uses the same grammar rules as javascript.

```js
// Primitive types are capped single words, eg:
Number
String

// Function types have multiple parameters
// The first type param, wrapped in brackets, are the types of the function's parameters
// The second type param is the type of the function's return value
// This function takes two Numbers as arguments and returns a Number
Function([Number, Number], Number)

// Object types can take an object-literal-formatted set of key names and types
Object({name: string, age: Number})

// You can alias one type as another with the '=' operator
Human = Object({name: String, age: Number})

// You can bind a variable name in your program to a type with the ':' operator
// This enforces that any variable named 'x' must have the type of Human, defined above
x : Human
```

#### automatic type inference

Running tipo on a javascript module will be able to catch basic type errors and infer the types of most things.

Since javascript is very weakly typed, you may want to add manual type declarations strengthen your code:

#### type declaration comments

You can manually describe the types in your program using type declarations in the comments, using the type language syntax, by prefixiing a sing-line comment with `type`:

_Example_

```js
// type add : Function([Number, Number], Number)
function add(x, y) {
  return  x + y
}

var x = add(1, 2)
// the type of x will be inferred to be 'Number'

// You can also declare types inside of a lexical scope:
function concat(x, y) {
  // type x : String
  // type y : String
  return x + y
}
// concat will be inferred to be the type 'Function([String, String], String)'

var y = concat('hi', 'there')
// the type of y will be inferred to be 'String'

var z = concat('hi', 22) // Throws type error
var q = add('hi', 22) // Throws type error

// type Human = Object({name: String, age: Number})
// finn : Human

var finn = {name: "Finn", age: 16} // Will have type of Human; no type errors thrown
var what = {name: 16, age: "Finn"} // Will throw a type error 

var partial = {name: "Finn"} // No type error; standard object types are "loose" -- they do not require all parameters
partial.age = "16" // Throws a type error; age must be a number
```


# development

This project is still in very early stages. If you are interested in helping, please post in the issues or get in touch with me at my email: jayrbolton at gmail
