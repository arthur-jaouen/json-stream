# @ja-ja/json-stream

Lightweight JSON stream parsing library, < 4KB ungzipped

Process huge json documents in small chunks to extract data without blowing up your memory

## Installation

### NPM

```
npm install @ja-ja/json-stream
```

### Yarn

```
yarn add @ja-ja/json-stream
```

## Unit tests

Run tests with `yarn test`. I tried to have as many tests as possible, but no one's perfect. A lot of tests were extracted from [JSONTestSuite](https://github.com/nst/JSONTestSuite) (See also [Parsing JSON is a minefield](https://seriot.ch/projects/parsing_json.html))

## Documentation / Samples

API documentation can be found in the `docs` folder, samples are located in the `samples` folder

## Roadmap

* BOM handling and UTF-16

## Usage

### Parsing a JSON string

The snippet below shows the equivalent of using `JSON.parse` (of course in this case using `JSON.parse` is actually much more efficient):

```js
import { parser } from '@ja-ja/json-stream'

function jsonParse(jsonString) {
    try {
        const { write, end } = parser({
            // Empty options, just parse the document without doing anything special
        })

        // The write() function takes a Uint8Array containing the raw JSON data
        // It takes care of UTF-8 decoding
        const buffer = new TextEncoder().encode(jsonString)

        write(buffer)

        // Calling end() returns the parsed document
        return end()
    } catch (error) {
        // Handle parsing error
        console.error(error)

        throw error
    }
}
```

### Streaming a `fetch` response

The snippet below shows how to parse a `fetch()` response in a streaming manner:

```js
import { parser } from '@ja-ja/json-stream'

async function streamFetchResponse(response, options) {
    try {
        const { write, end } = parser(options)

        // Get a stream reader from the response body
        const reader = response.body.getReader()

        // Read some data when it's available
        let buffer = await reader.read()

        while (!buffer.done && buffer.value !== undefined) {
            // Write each chunk of the response
            write(buffer.value)

            buffer = await reader.read()
        }

        // Calling end() returns the parsed document
        return end()
    } catch (error) {
        // Handle parsing error
        console.error(error)

        throw error
    }
}
```

### Streaming a JSON file in Node.js

The snippet below shows how to parse a JSON file in a streaming manner in Node.js:

```js
import { parser } from '@ja-ja/json-stream'
import { open } from 'node:fs/promises'

async function streamJsonFile(path, options) {
    try {
        const { write, end } = parser(options)

        // Open the file
        const buffer = new Uint8Array(1024)
        const file = await open(path)

        // Read some data when it's available
        let res = await file.read({ buffer })

        while (res.bytesRead > 0) {
            // Write each chunk of the response
            write(buffer.subarray(0, res.bytesRead))

            res = await file.read({ buffer })
        }

        file.close()

        // Calling end() returns the parsed document
        return end()
    } catch (error) {
        // Handle parsing error
        console.error(error)

        throw error
    }
}
```

### Ignoring elements

Ignoring an element means that while the JSON is still parsed and validated, no data will be created for that element, your options won't be executed for its children elements and nothing will be registered in the parent element:

```js
import { parser } from '@ja-ja/json-stream'

const { write, end } = parser({
    ignore: (path) => path.isKey(0, 'a'),
})

write(new TextEncoder().encode('{"a":1,"b":2}'))

const result = end()

// result === { b: 2 }
```

### Getting raw JSON data

Much like when ignoring, the JSON is still parsed and validated, no data will be created for that element, your options won't be executed for its children elements, however the raw JSON data is recorded as the value (without whitespaces):

```js
import { parser } from '@ja-ja/json-stream'

const { write, end } = parser({
    raw: (path) => path.isKey(0, 'a'),
})

write(new TextEncoder().encode('{"a":1,"b":2}'))

const result = end()

// result === { a: Uint8Array([49]), b: 2 }
```

### Transforming elements

You can act on created elements and transform them, replace them, etc. using the `transform` function:

```js
import { parser } from '@ja-ja/json-stream'

const { write, end } = parser({
    transform: (path, value) => (path.isKey(0, 'a') ? 'tranformed' : value),
})

write(new TextEncoder().encode('{"a":1,"b":2}'))

const result = end()

// result === { a: 'transformed', b: 2 }
```

### Dropping elements

Instead of ignoring entirely the element you can also parse it, and decide to drop it (which means the element won't be registered in its parent element and can be reclaimed by the garbage collector)

```js
import { parser } from '@ja-ja/json-stream'

const { write, end } = parser({
    drop: (path, value) => value === 1,
})

write(new TextEncoder().encode('{"a":1,"b":2}'))

const result = end()

// result === { b: 2 }
```

### Parse an array, dropping elements as you go

```js
import { parser } from '@ja-ja/json-stream'

const { write, end } = parser({
    drop: (path, value) => {
        if (path.length() === 1) {
            // Handle the value
            doStuff(value)

            // Drop the value (don't push it in the root array)
            return true
        }

        return false
    },
})

write(new TextEncoder().encode('[1, 2, 3, 4, 5, "... my infinite array"]'))

const result = end()

// result === []
```
