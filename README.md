
# react-fetchy

[![Build Status](https://travis-ci.org/LoicMahieu/react-fetchy.svg?branch=master)](https://travis-ci.org/LoicMahieu/react-fetchy)
[![npm](https://img.shields.io/npm/v/react-fetchy.svg)](https://www.npmjs.com/package/react-fetchy)

react-fetchy is a React component that let makes fetch call easily by using "Function as Child components" pattern.

### Example

```js
const PostList = () => (
  <Fetchy url="https://jsonplaceholder.typicode.com/todos">
    {({ fetch, state: { value: todos } }) => (
      <div>
        <h1>Todos</h1>
        <button onClick={fetch}>Refresh</button>
        <ul>
          {(todos || []).map(todo => <li key={todo.id}>{todo.title}</li>)}
        </ul>
      </div>
    )}
  </Fetchy>
);
```

See [CodeSandbox](https://codesandbox.io/s/01v3kj6nnw)
