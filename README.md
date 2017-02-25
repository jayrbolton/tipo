# tipo

This is a work-in-progress that intends to add a type system to plain JS programs without touching the language itself, using type inference. Explicit type expressions can be added into specially-demarcated comments. It is intended to help check program correctness, increase maintainability, and generate documentation. It is strictly an add-on static analyzer (no need to transpile anything or modify the language itself).

Current status: 
- Most of basic es2015 has working type inference
- Basic type annotation in comments is implemented

_Example_

```js
//type add : Function([Number, Number], Number)
function add(x, y) {
  return  x + y
}

var x = add(1, 2)
```

_Result_

```
add : Function([Number, Number], Number)
x : Number
```

_Example code that raises type errors_

```js
var x = 'hi' * y // ERROR

//type incr : Function([Number], Number)
function add(x, y) {return x + 1}

incr('hi') // ERROR

var obj = {x: "hi"}

incr(obj.x) // ERROR

//type Human = Object({name: String, age: String})
//type x : Human
var x = {name: 45, age: "Bob"} // ERROR
```


If you are interested in this project, either in using it or collaborating on it, get in touch with me at my email: jayrbolton at gmail
