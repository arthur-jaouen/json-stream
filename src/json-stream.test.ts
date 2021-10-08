import { parse, StreamReader, entries, Query, skip, filter, transform } from './json-stream'

class StreamMock implements StreamReader<Uint8Array> {
    constructor(public buffers: string[], public i = 0) {}

    async read() {
        const done = this.i >= this.buffers.length
        const value = done ? undefined : new TextEncoder().encode(this.buffers[this.i++])

        return { done, value }
    }

    releaseLock() {}
}

const json = [
    '{"a":"b',
    '","c":"d \\n \\t \\r \\f \\',
    'b \\\\ \\" \\u1234 \\u1234 ሴ ሴ"',
    ', "e": 1, "f": -1, "g":-0, "h":0, "i":-23e-5, "j": 3.14',
    ', "k": true, "l":false, "m": null, ',
    '"n": [], "o": {}, "p": [1, {}, [], "gdf"], "q": {"a": [1,"a",{}]}}',
]

const parsed = JSON.parse(json.join(''))

it('parse', async () => {
    const result = await parse(new StreamMock(json), {})

    expect(result).toEqual(parsed)
})

it('parse number', async () => {
    const result = await parse(new StreamMock(['1']), {})

    expect(result).toEqual(1)
})

describe('skip', () => {
    it('entries', async () => {
        const query: Query = { [entries]: { [skip]: () => true } }
        const result = await parse(new StreamMock(json), query)

        expect(result).toEqual({})
    })

    it('nested entries', async () => {
        const query: Query = { [entries]: { [entries]: { [skip]: () => true } } }
        const result = await parse(new StreamMock(json), query)

        const expected = { ...parsed, p: [], q: {} }

        expect(result).toEqual(expected)
    })

    it('specific entry', async () => {
        const query: Query = { a: { [skip]: () => true } }
        const result = await parse(new StreamMock(json), query)

        const { a: _, ...expected } = parsed

        expect(result).toEqual(expected)
    })
})

describe('tranform', () => {
    it('root', async () => {
        const tranformed = 'my tranformed root'
        const query: Query = { [transform]: () => tranformed }
        const result = await parse(new StreamMock(json), query)

        expect(result).toEqual(tranformed)
    })

    it('entries', async () => {
        const tranformed = 'my tranformed entry'
        const query: Query = { [entries]: { [transform]: () => tranformed } }
        const result = await parse(new StreamMock(json), query)

        const expected: any = {}
        for (const key of Object.keys(parsed)) {
            expected[key] = tranformed
        }

        expect(result).toEqual(expected)
    })

    it('specific entry', async () => {
        const tranformed = 'my tranformed a'
        const query: Query = { a: { [transform]: () => tranformed } }
        const result = await parse(new StreamMock(json), query)

        const expected = { ...parsed, a: tranformed }

        expect(result).toEqual(expected)
    })
})

describe('filter', () => {
    it('entries', async () => {
        const query: Query = { [entries]: { [filter]: () => false } }
        const result = await parse(new StreamMock(json), query)

        expect(result).toEqual({})
    })

    it('nested entries', async () => {
        const query: Query = { [entries]: { [entries]: { [filter]: () => false } } }
        const result = await parse(new StreamMock(json), query)

        const expected = { ...parsed, p: [], q: {} }

        expect(result).toEqual(expected)
    })

    it('specific entry', async () => {
        const query: Query = { a: { [filter]: () => false } }
        const result = await parse(new StreamMock(json), query)

        const { a: _, ...expected } = parsed

        expect(result).toEqual(expected)
    })
})
