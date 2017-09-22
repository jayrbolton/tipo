const T = require('../lib/types')
const checkModule = require('../lib/checkModule')

const BTree = valType => T.Obj({
  type: T.value('BTree'),
  childCount: T.Num(),
  left: T.Any([T.Null(), valType]), // , BTree(t) TODO
  right: T.Any([T.Null(), valType])
})

const node = T.Func(a => ({
  input: [a, a],
  output: BTree(a)
}))

const typeset = {
  node: node
}

checkModule('./examples/btree.js', typeset, (state) => {
  console.log('done', JSON.stringify(state, null, 2))
})

/*
const Left = Val('left')
const Right = Val('right')
const Dir = Any([Left, Right])

// Binary tree type
const BTree = t => other =>
  Obj({
    type: Val('BTree'),
    childCount: Num,
    left: Any([Null, t, BTree(t)]),
    right: Any([Null, t, BTree(t)])
  })(other)


// Set (mutate) the left right child for a node
// eg. setValue(1, 'left', node) ; setValue(2, 'right', node)
assertType(setValue, Func({
  input: [Var('a'), Dir, BTree(Var('a'))],
  output: BTree(Var('a'))
}))
function setValue (v, dir, node) {
  if (node[dir] === null) {
    node.childCount += 1
  }
  node[dir] = v
  return node
}

// Apply a function to every plain value in the tree
function map (fn, root) {
  let stack = [root]
  while (stack.length) {
    let current = stack.pop()
    ['left', 'right'].forEach(dir => {
      if (current[dir].type === 'BTree') {
        stack.push(current[dir])
      } else if (current[dir] !== null) {
        current[dir] = fn(current[dir])
      }
    })
  }
  return root
}
 
const t = {type: 'BTree', childCount: 1, left: 'a', right: null}

assertType(t, BTree(Str))
assertType([1, '1'], Arr(Any([Num, Str])))

function add (x, y) { return x + y }

assertType(add, Func({
  input: [Num, Num],
  output: Num
}))

function returnNum (x) { return 1 }

assertType(returnNum, Func({input: [Var('a')], output: Num}))

assertType(node, Func({
  input: [Num],
  output: BTree(Num)
}))
*/
