
// Create an empty node
const node = (l, r) => {
  return {
    type: 'BTree',
    childCount: 0,
    left: l,
    right: r
  }
}

const t1 = node(1, 2)
