export const entries: unique symbol = Symbol()
export const skip: unique symbol = Symbol()
export const transform: unique symbol = Symbol()
export const filter: unique symbol = Symbol()

export type Query = {
    [key: string]: Query

    [entries]?: Query
    [skip]?: (key: string) => boolean
    [transform]?: (value: any) => any
    [filter]?: (value: any) => boolean
}

export interface StreamReader<T> {
    read(): Promise<{ done: boolean; value?: T }>

    releaseLock(): void
}

export function parse<T = any>(reader: StreamReader<Uint8Array>, query: Query): Promise<T> {
    return new Promise(parseStream.bind(null, reader, query))
}

const STATE_VALUE = 0
const STATE_VALUE_DONE = 1
const STATE_END = 2
const STATE_SKIP = 3
const STATE_SKIP_OBJ = 4
const STATE_SKIP_ARR = 5
const STATE_SKIP_STR = 6
const STATE_SKIP_STR_SLASH = 7
const STATE_SKIP_ANY = 8
const STATE_OBJ = 9
const STATE_OBJ_KEY_DONE = 10
const STATE_OBJ_VALUE_DONE = 11
const STATE_OBJ_ENTRY_DONE = 12
const STATE_ARR = 13
const STATE_ARR_VALUE_DONE = 14
const STATE_ARR_ENTRY_DONE = 15
const STATE_STR = 16
const STATE_STR_UTF_1 = 17
const STATE_STR_UTF_2 = 18
const STATE_STR_UTF_3 = 19
const STATE_STR_SLASH = 20
const STATE_STR_UNICODE_1 = 21
const STATE_STR_UNICODE_2 = 22
const STATE_STR_UNICODE_3 = 23
const STATE_STR_UNICODE_4 = 24
const STATE_NUM_MINUS = 25
const STATE_NUM_ZERO = 26
const STATE_NUM_INT = 27
const STATE_NUM_DOT = 28
const STATE_NUM_FRACTION = 29
const STATE_NUM_EXP = 30
const STATE_NUM_EXP_SIGNED = 31
const STATE_NUM_EXP_DIGIT = 32
const STATE_TRUE_T = 33
const STATE_TRUE_R = 34
const STATE_TRUE_U = 35
const STATE_FALSE_F = 36
const STATE_FALSE_A = 37
const STATE_FALSE_L = 38
const STATE_FALSE_S = 39
const STATE_NULL_N = 40
const STATE_NULL_U = 41
const STATE_NULL_L = 42

function ws(b: number): boolean {
    return b === 0x20 /* ' ' */ || b === 0x0a /* \n */ || b === 0x0d /* \r */ || b === 0x09 /* \t */
}

function hex(b: number): boolean {
    return (
        (b >= 0x30 && b <= 0x39) /* 0 - 9 */ ||
        (b >= 0x41 && b <= 0x46) /* A - F */ ||
        (b >= 0x61 && b <= 0x66) /* a - f */
    )
}

function parseStream(
    reader: StreamReader<Uint8Array>,
    query: Query,
    resolve: (result: any) => void,
    reject: (error: Error) => void
) {
    let s: number = STATE_VALUE
    let i: number = 0

    let v: any = null
    let d: boolean = false
    let e: boolean = false

    let cur: number = 0
    let str: number[] = []
    let neg: boolean = false

    const states: number[] = [STATE_VALUE_DONE]
    const values: any[] = []
    const queries: Query[] = []

    function doValue(b: number): void {
        values.push(v)

        b === 0x22 /* " */
            ? (s = STATE_STR)
            : b === 0x7b /* { */
            ? ((v = {}), (s = STATE_OBJ))
            : b === 0x5b /* [ */
            ? ((v = []), (s = STATE_ARR))
            : b === 0x74 /* t */
            ? (s = STATE_TRUE_T)
            : b === 0x66 /* f */
            ? (s = STATE_FALSE_F)
            : b === 0x6e /* n */
            ? (s = STATE_NULL_N)
            : b === 0x2d /* - */
            ? (s = STATE_NUM_MINUS)
            : b === 0x30 /* 0 */
            ? (s = STATE_NUM_ZERO)
            : b >= 0x31 && b <= 0x39 /* 1 - 9 */
            ? ((v = b - 0x30), (s = STATE_NUM_INT))
            : (e = true)
    }

    function doSkip(b: number): void {
        b === 0x7b /* { */
            ? ((cur = 0), (s = STATE_SKIP_OBJ))
            : b === 0x5b /* [ */
            ? ((cur = 0), (s = STATE_SKIP_ARR))
            : b === 0x22 /* " */
            ? (s = STATE_SKIP_STR)
            : ws(b) ||
              (b === 0x5d /* ] */ || b === 0x7d /* } */ || b === 0x2c /* , */
                  ? ((s = states.pop()!), i--)
                  : (s = STATE_SKIP_ANY))
    }

    function entryDone(b: number, delim: number, state: number): void {
        b === 0x2c /* , */ ? (s = state) : b === delim ? (s = states.pop()!) : ws(b) || (e = true)
    }

    function parseByte(b: number): void {
        i++

        switch (s) {
            // Root
            case STATE_VALUE:
                ws(b) || doValue(b)
                break

            case STATE_VALUE_DONE:
                query[transform] && (v = query[transform]!(v)), (d = true), (s = STATE_END)
                b === 0 || ws(b) || (e = true)
                break

            case STATE_END:
                b === 0 || ws(b) || (e = true)
                break

            // Skip
            case STATE_SKIP:
                doSkip(b)
                break

            case STATE_SKIP_OBJ:
                b === 0x22 /* " */
                    ? (states.push(STATE_SKIP_OBJ), (s = STATE_SKIP_STR))
                    : b === 0x7b /* { */
                    ? cur++
                    : b === 0x7d /* } */ && cur-- === 0 && (s = states.pop()!)

                break

            case STATE_SKIP_ARR:
                b === 0x22 /* " */
                    ? (states.push(STATE_SKIP_ARR), (s = STATE_SKIP_STR))
                    : b === 0x5b /* [ */
                    ? cur++
                    : b === 0x5d /* ] */ && cur-- === 0 && (s = states.pop()!)

                break

            case STATE_SKIP_STR:
                b === 0x22 /* " */
                    ? (s = states.pop()!)
                    : b === 0x5c /* \ */ && (s = STATE_SKIP_STR_SLASH)

                break

            case STATE_SKIP_STR_SLASH:
                s = STATE_SKIP_STR

                break

            case STATE_SKIP_ANY:
                if (b === 0x5d /* ] */ || b === 0x7d /* } */ || b === 0x2c /* , */) {
                    s = states.pop()!
                    i--
                }

                break

            // Object
            case STATE_OBJ:
                b === 0x22 /* " */
                    ? (values.push(v), states.push(STATE_OBJ_KEY_DONE), (s = STATE_STR))
                    : b === 0x7d /* } */
                    ? (s = states.pop()!)
                    : ws(b) || (e = true)

                break

            case STATE_OBJ_KEY_DONE:
                if (b == 0x3a /* : */) {
                    const q = query[v] || query[entries] || {}

                    if (q[skip] && q[skip]!(v)) {
                        v = values.pop()!
                        states.push(STATE_OBJ_ENTRY_DONE)
                        s = STATE_SKIP
                    } else {
                        queries.push(query)
                        query = q
                        states.push(STATE_OBJ_VALUE_DONE)
                        s = STATE_VALUE
                    }
                } else {
                    ws(b) || (e = true)
                }

                break

            case STATE_OBJ_VALUE_DONE:
                if (query[transform]) {
                    v = query[transform]!(v)
                }

                const val = v
                const key = values.pop()!
                v = values.pop()!

                if (!query[filter] || query[filter]!(val)) {
                    v[key] = val
                }

                query = queries.pop()!
                s = STATE_OBJ_ENTRY_DONE
                entryDone(b, 0x7d /* } */, STATE_OBJ)
                break

            case STATE_OBJ_ENTRY_DONE:
                entryDone(b, 0x7d /* } */, STATE_OBJ)
                break

            // Array
            case STATE_ARR:
                if (b == 0x5d /* ] */) {
                    s = states.pop()!
                } else if (ws(b)) {
                    // TODO
                } else {
                    const q = query[entries] || {}

                    if (q[skip] && q[skip]!('')) {
                        states.push(STATE_ARR_ENTRY_DONE)
                        doSkip(b)
                    } else {
                        queries.push(query)
                        query = q
                        states.push(STATE_ARR_VALUE_DONE)
                        doValue(b)
                    }
                }

                break

            case STATE_ARR_VALUE_DONE:
                if (query[transform]) {
                    v = query[transform]!(v)
                }

                const item = v
                v = values.pop()!

                if (!query[filter] || query[filter]!(item)) {
                    v.push(item)
                }

                query = queries.pop()!
                s = STATE_ARR_ENTRY_DONE
                entryDone(b, 0x5d /* ] */, STATE_ARR)

                break

            case STATE_ARR_ENTRY_DONE:
                entryDone(b, 0x5d /* ] */, STATE_ARR)
                break

            // String
            case STATE_STR:
                b === 0x22 /* " */
                    ? ((v = String.fromCharCode(...str)), (str.length = 0), (s = states.pop()!))
                    : b === 0x5c /* \ */
                    ? (s = STATE_STR_SLASH)
                    : b >= 0x20 /* ' ' */ && b <= 0x7f /* DEL */
                    ? str.push(b)
                    : b >= 0xc0 && b <= 0xdf
                    ? ((cur = b - 0xc0), (s = STATE_STR_UTF_1))
                    : b >= 0xe0 && b <= 0xef
                    ? ((cur = b - 0xe0), (s = STATE_STR_UTF_2))
                    : b >= 0xf0 && b <= 0xf7
                    ? ((cur = b - 0xf0), (s = STATE_STR_UTF_3))
                    : (e = true)

                break

            case STATE_STR_UTF_1:
                if (b >= 0x80 && b <= 0xbf) {
                    str.push((cur << 6) + b - 0x80)
                    s = STATE_STR
                } else {
                    e = true
                }

                break

            case STATE_STR_UTF_2:
            case STATE_STR_UTF_3:
                if (b >= 0x80 && b <= 0xbf) {
                    cur = (cur << 6) + b - 0x80
                    s--
                } else {
                    e = true
                }

                break

            case STATE_STR_SLASH:
                s = STATE_STR

                b === 0x22 /* " */ || b === 0x5c /* \ */ || b === 0x2f /* / */
                    ? str.push(b)
                    : b === 0x62 /* b */
                    ? str.push(0x08)
                    : b === 0x66 /* f */
                    ? str.push(0x0c)
                    : b === 0x6e /* n */
                    ? str.push(0x0a)
                    : b === 0x72 /* r */
                    ? str.push(0x0d)
                    : b === 0x74 /* t */
                    ? str.push(0x09)
                    : b === 0x75 /* u */
                    ? ((cur = 0), (s = STATE_STR_UNICODE_4))
                    : (e = true)

                break

            case STATE_STR_UNICODE_1:
                if (hex(b)) {
                    str.push(cur * 16 + b - 0x30)
                    s = STATE_STR
                } else {
                    e = true
                }

                break

            case STATE_STR_UNICODE_2:
            case STATE_STR_UNICODE_3:
            case STATE_STR_UNICODE_4:
                if (hex(b)) {
                    cur = cur * 16 + b - 0x30
                    s--
                } else {
                    e = true
                }

                break

            // Number
            case STATE_NUM_MINUS:
                neg = true

                if (b === 0x30 /* 0 */) {
                    s = STATE_NUM_ZERO
                } else if (b >= 0x31 && b <= 0x39 /* 1 - 9 */) {
                    v = b - 0x30
                    s = STATE_NUM_INT
                } else {
                    e = true
                }

                break

            case STATE_NUM_ZERO:
                b === 0x2e /* . */
                    ? (s = STATE_NUM_DOT)
                    : b === 0x65 || b === 0x45 /* e|E */
                    ? (s = STATE_NUM_EXP)
                    : ((v = neg ? -0 : 0), (neg = false), (s = states.pop()!), i--)

                break

            case STATE_NUM_INT:
                b >= 0x30 && b <= 0x39 /* 0 - 9 */
                    ? ((v = v * 10 + b - 0x30), (s = STATE_NUM_INT))
                    : b === 0x2e /* . */
                    ? (s = STATE_NUM_DOT)
                    : b === 0x65 || b === 0x45 /* e|E */
                    ? (s = STATE_NUM_EXP)
                    : ((v = neg ? -v : v), (neg = false), (s = states.pop()!), i--)

                break

            case STATE_NUM_DOT:
                if (b >= 0x30 && b <= 0x39 /* 0 - 9 */) {
                    v = v + 0.1 * (b - 0x30)
                    cur = 100
                    s = STATE_NUM_FRACTION
                } else {
                    e = true
                }

                break

            case STATE_NUM_FRACTION:
                if (b >= 0x30 && b <= 0x39 /* 0 - 9 */) {
                    v = v + (b - 0x30) / cur
                    cur *= 10
                    s = STATE_NUM_FRACTION
                } else if (b === 0x65 || b === 0x45 /* e|E */) {
                    s = STATE_NUM_EXP
                } else {
                    v = neg ? -v : v
                    neg = false
                    s = states.pop()!
                    i--
                }

                break

            case STATE_NUM_EXP:
                v = neg ? -v : v
                neg = false

                b >= 0x30 && b <= 0x39 /* 0 - 9 */
                    ? ((cur = b - 0x30), (s = STATE_NUM_EXP_DIGIT))
                    : b === 0x2b /* + */
                    ? (s = STATE_NUM_EXP_SIGNED)
                    : b === 0x2d /* - */
                    ? ((neg = true), (s = STATE_NUM_EXP_SIGNED))
                    : (e = true)

                break

            case STATE_NUM_EXP_SIGNED:
                if (b >= 0x30 && b <= 0x39 /* 0 - 9 */) {
                    cur = b - 0x30
                    s = STATE_NUM_EXP_DIGIT
                } else {
                    e = true
                }

                break

            case STATE_NUM_EXP_DIGIT:
                if (b >= 0x30 && b <= 0x39 /* 0 - 9 */) {
                    cur = cur * 10 + b - 0x30
                    s = STATE_NUM_EXP_DIGIT
                } else {
                    v = neg ? v / Math.pow(10, cur) : v * Math.pow(10, cur)
                    neg = false
                    s = states.pop()!
                    i--
                }

                break

            // True
            case STATE_TRUE_T:
                b === 0x72 /* r */ ? (s = STATE_TRUE_R) : (e = true)
                break
            case STATE_TRUE_R:
                b === 0x75 /* u */ ? (s = STATE_TRUE_U) : (e = true)
                break
            case STATE_TRUE_U:
                b === 0x65 /* e */ ? ((v = true), (s = states.pop()!)) : (e = true)
                break

            // False
            case STATE_FALSE_F:
                b === 0x61 /* a */ ? (s = STATE_FALSE_A) : (e = true)
                break
            case STATE_FALSE_A:
                b === 0x6c /* l */ ? (s = STATE_FALSE_L) : (e = true)
                break
            case STATE_FALSE_L:
                b === 0x73 /* s */ ? (s = STATE_FALSE_S) : (e = true)
                break
            case STATE_FALSE_S:
                b === 0x65 /* e */ ? ((v = false), (s = states.pop()!)) : (e = true)
                break

            // Null
            case STATE_NULL_N:
                b === 0x75 /* u */ ? (s = STATE_NULL_U) : (e = true)
                break
            case STATE_NULL_U:
                b === 0x6c /* l */ ? (s = STATE_NULL_L) : (e = true)
                break
            case STATE_NULL_L:
                b === 0x6c /* l */ ? ((v = null), (s = states.pop()!)) : (e = true)
                break
        }
    }

    function onStreamResponse(response: { done: boolean; value?: Uint8Array }) {
        if (response.done || response.value === undefined) {
            reader.releaseLock()

            i = 0
            do {
                parseByte(0)
            } while (!e && i === 0)

            if (e || !d) {
                reject(new Error('Reached EOF' + s))
            } else {
                resolve(v)
            }

            return
        }

        const buffer = response.value

        i = 0

        try {
            while (!e && i < buffer.length) {
                parseByte(buffer[i])
            }
        } catch (error) {
            console.error(error)
            e = true
        }

        if (e) {
            reader.releaseLock()

            const char = String.fromCharCode(buffer[i])
            const json = buffer ? new TextDecoder().decode(buffer) : ''

            reject(new Error(`Char ${i} '${char}':\n${json}`))
        } else {
            reader.read().then(onStreamResponse)
        }
    }

    reader.read().then(onStreamResponse)
}
