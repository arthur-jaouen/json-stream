export const entries: unique symbol = Symbol()
export const skip: unique symbol = Symbol()
export const transform: unique symbol = Symbol()
export const filter: unique symbol = Symbol()

export type Query = {
    [key: string]: Query

    [entries]?: Query
    [skip]?: Skip
    [transform]?: Transformer
    [filter]?: Filter
}

export type Skip = (key: string | number) => boolean

export type Transformer = (value: any) => any

export type Filter = (value: any) => boolean

export interface StreamReader<T> {
    read(): Promise<{ done: boolean; value?: T }>

    releaseLock(): void
}

export function parse<T = any>(stream: StreamReader<Uint8Array>, query: Query): Promise<T> {
    return new Promise((resolve, reject) => {
        let value: any = null
        let next = start((v) => (value = v), query)

        function parseStream(): Promise<undefined> {
            return stream.read().then((res) => {
                if (res.done) {
                    if (value === null) {
                        reject(new Error('Reached early end of stream'))
                    } else {
                        resolve(value)
                    }

                    return
                }

                if (res.value === undefined) {
                    return
                }

                const buffer = res.value
                let i = 0

                try {
                    while (i < buffer.length) {
                        next = next(buffer[i])
                        i++
                    }
                } catch (e) {
                    console.error(e)

                    const char = String.fromCharCode(buffer[i])
                    const json = new TextDecoder().decode(buffer)

                    reject(new Error(`Char ${i} '${char}':\n${json}`))
                }

                return parseStream()
            })
        }

        parseStream().finally(() => {
            stream.releaseLock()
        })
    })
}

type Parser = (c: number) => Parser
type JsonObject = Record<string, any>

function start(done: (value: any) => void, query: Query): Parser {
    function valueDone(value: any): Parser {
        const t = query[transform]

        done(t ? t(value) : value)

        return objEnd
    }

    function objEnd(c: number): Parser {
        return (ws(c) && objEnd) || error()
    }

    return value(valueDone, query)
}

function error(): Parser {
    throw new Error()
}

function ws(c: number): boolean {
    return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d
}

function kw(done: (value: any) => Parser, s: number[], value: any): Parser {
    let counter = 0

    function nextChar(c: number): Parser {
        return (
            (c === s[counter] && (counter < s.length - 1 ? (counter++, nextChar) : done(value))) ||
            error()
        )
    }

    return nextChar
}

// object

function obj(done: (obj: JsonObject) => Parser, query: Query): Parser {
    const obj: JsonObject = {}

    let key: string = '',
        q: Query

    function keyStart(c: number): Parser {
        return (
            (ws(c) && keyStart) ||
            (c === 0x22 /* " */ && str(keyDone)) ||
            (c === 0x7d /* } */ && done(obj)) ||
            error()
        )
    }

    function keyDone(k: string): Parser {
        key = k

        return valueStart
    }

    function valueStart(c: number): Parser {
        q = query[key] || query[entries] || {}

        return (
            (ws(c) && valueStart) ||
            (c === 0x3a /* : */ &&
                (q[skip] && q[skip]!(key) ? valueSkip(entryDone) : value(valueDone, q))) ||
            error()
        )
    }

    function valueDone(value: any): Parser {
        if (q[transform]) {
            value = q[transform]!(value)
        }

        if (!q[filter] || q[filter]!(value)) {
            obj[key] = value
        }

        return entryDone
    }

    function entryDone(c: number): Parser {
        return (
            (ws(c) && entryDone) ||
            (c === 0x2c /* , */ && keyStart) ||
            (c === 0x7d /* } */ && done(obj)) ||
            error()
        )
    }

    return keyStart
}

// array

function arr(done: (arr: any[]) => Parser, query: Query): Parser {
    const arr: any[] = []

    let i = 0,
        q: Query

    function valueStart(c: number): Parser {
        q = query[i] || query[entries] || {}

        return (
            (ws(c) && valueStart) ||
            (c === 0x5d /* ] */ && done(arr)) ||
            (q[skip] && q[skip]!(i) ? valueSkip(entryDone)(c) : value(valueDone, q)(c))
        )
    }

    function valueDone(value: any): Parser {
        if (q[transform]) {
            value = q[transform]!(value)
        }

        if (!q[filter] || q[filter]!(value)) {
            arr.push(value)
        }

        return entryDone
    }

    function entryDone(c: number): Parser {
        i++

        return (
            (ws(c) && entryDone) ||
            (c === 0x2c /* , */ && valueStart) ||
            (c === 0x5d /* ] */ && done(arr)) ||
            error()
        )
    }

    return valueStart
}

// string

function str(done: (str: string) => Parser): Parser {
    let str: number[] = []
    let unicode: number = 0
    let counter: number = 0

    function charStart(c: number): Parser {
        return (
            (c === 0x22 /* " */ && done(String.fromCharCode(...str))) ||
            (c === 0x5c /* \ */ && slash) ||
            (c >= 0x20 /* ' ' - <end> */ && charDone(c)) ||
            error()
        )
    }

    function charDone(c: number): Parser {
        str.push(c)

        return charStart
    }

    function slash(c: number): Parser {
        return (
            ((c === 0x22 /* " */ || c === 0x5c /* \ */ || c === 0x2f) /* / */ && charDone(c)) ||
            (c === 0x62 /* c */ && charDone(0x08 /* \c */)) ||
            (c === 0x66 /* f */ && charDone(0x0c /* \f */)) ||
            (c === 0x6e /* n */ && charDone(0x0a /* \n */)) ||
            (c === 0x72 /* r */ && charDone(0x0d /* \r */)) ||
            (c === 0x74 /* t */ && charDone(0x09 /* \t */)) ||
            (c === 0x75 /* u */ && unicodeStart) ||
            error()
        )
    }

    function unicodeStart(c: number): Parser {
        unicode = unicode * 16 + (c - 0x30)
        counter++

        return (
            (((c >= 0x30 && c <= 0x39) /* 0 - 9 */ ||
                (c >= 0x41 && c <= 0x46) /* A - F */ ||
                (c >= 0x61 && c <= 0x66)) /* a - f */ &&
                (counter === 4 ? charDone(unicode) : unicodeStart)) ||
            error()
        )
    }

    return charStart
}

// number

function num(done: (n: number) => Parser, c: number): Parser {
    let n: number = 0
    let neg: boolean = false
    let e: number = 0

    function minus(c: number): Parser {
        neg = true

        return (
            (c === 0x30 /* 0 */ && zero) ||
            (c >= 0x31 && c <= 0x39 /* 1 - 9 */ && ((n = c - 0x30), intDigit)) ||
            error()
        )
    }

    function zero(c: number): Parser {
        return (
            (c === 0x2e /* . */ && fractionStart) ||
            (c === 0x65 /* e */ && expStart) ||
            (c === 0x45 /* E */ && expStart) ||
            done(neg ? -0 : 0)(c)
        )
    }

    function intDigit(c: number): Parser {
        return (
            (c >= 0x30 && c <= 0x39 /* 0 - 9 */ && ((n = n * 10 + c - 0x30), intDigit)) ||
            (c === 0x2e /* . */ && fractionStart) ||
            (c === 0x65 /* e */ && expStart) ||
            (c === 0x45 /* E */ && expStart) ||
            done(neg ? -n : n)(c)
        )
    }

    function fractionStart(c: number): Parser {
        return (
            (c >= 0x30 &&
                c <= 0x39 /* 0 - 9 */ &&
                ((n = n + 0.1 * (c - 0x30)), (e = 0.01), fractionDigit)) ||
            error()
        )
    }

    function fractionDigit(c: number): Parser {
        return (
            (c >= 0x30 &&
                c <= 0x39 /* 0 - 9 */ &&
                ((n = n + e * (c - 0x30)), (e *= 0.1), fractionDigit)) ||
            (c === 0x65 /* e */ && expStart) ||
            (c === 0x45 /* E */ && expStart) ||
            done(neg ? -n : n)(c)
        )
    }

    function expStart(c: number): Parser {
        n = neg ? -n : n
        neg = false

        return (
            (c >= 0x30 && c <= 0x39 /* 0 - 9 */ && ((e = c - 0x30), expDigit)) ||
            (c === 0x2b /* + */ && expSigned) ||
            (c === 0x2d /* - */ && ((neg = true), expSigned)) ||
            error()
        )
    }

    function expSigned(c: number): Parser {
        e = c - 0x30

        return (c >= 0x30 && c <= 0x39 /* 0 - 9 */ && expDigit) || error()
    }

    function expDigit(c: number): Parser {
        return (
            (c >= 0x30 && c <= 0x39 /* 0 - 9 */ && ((e = e * 10 + c - 0x30), expDigit)) ||
            done(neg ? n / Math.pow(10, e) : n * Math.pow(10, e))(c)
        )
    }

    return (
        (c === 0x2d /* - */ && minus) ||
        (c === 0x30 /* 0 */ && zero) ||
        (c >= 0x31 && c <= 0x39 /* 1 - 9 */ && ((n = c - 0x30), intDigit)) ||
        error()
    )
}

// value

function value(done: (value: any) => Parser, query: Query): Parser {
    return (c) =>
        (ws(c) && value(done, query)) ||
        (c === 0x22 /* " */ && str(done)) ||
        (c === 0x7b /* { */ && obj(done, query)) ||
        (c === 0x5b /* [ */ && arr(done, query)) ||
        (c === 0x74 /* t */ && kw(done, [0x72 /* r */, 0x75 /* u */, 0x65 /* e */], true)) ||
        (c === 0x66 /* f */ &&
            kw(done, [0x61 /* a */, 0x6c /* l */, 0x73 /* s */, 0x65 /* e */], false)) ||
        (c === 0x6e /* n */ && kw(done, [0x75 /* u */, 0x6c /* l */, 0x6c /* l */], null)) ||
        num(done, c)
}

// skip

function valueSkip(next: Parser): Parser {
    let level = 0

    function skipStart(c: number): Parser {
        return (
            (ws(c) && skipStart) ||
            (c === 0x22 /* " */ && str(next)) ||
            (c === 0x7b /* { */ && obj) ||
            (c === 0x5b /* [ */ && arr) ||
            any
        )
    }

    function str(next: Parser): Parser {
        function char(c: number): Parser {
            return (c === 0x22 /* " */ && next) || (c === 0x5c /* \ */ && slash) || char
        }

        function slash(_c: number): Parser {
            return char
        }

        return char
    }

    function obj(c: number): Parser {
        return (
            (c === 0x22 /* " */ && str(obj)) ||
            (c === 0x7b /* { */ && (level++, obj)) ||
            (c === 0x7d /* } */ && (level == 0 ? next : (level--, obj))) ||
            obj
        )
    }

    function arr(c: number): Parser {
        return (
            (c === 0x22 /* " */ && str(arr)) ||
            (c === 0x5b /* [ */ && (level++, arr)) ||
            (c === 0x5d /* ] */ && (level == 0 ? next : (level--, arr))) ||
            arr
        )
    }

    function any(c: number): Parser {
        return ((c === 0x5d /* ] */ || c === 0x7d /* } */ || c === 0x2c) /* , */ && next(c)) || any
    }

    return skipStart
}
