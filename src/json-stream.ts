export interface Path {
    /**
     * Returns the path length
     *
     * @returns {number}
     */
    length(): number

    /**
     * Returns true if the given path item is equal to the given key
     *
     * @param {number} item
     * @param {string} key
     * @returns {boolean}
     */
    isKey(item: number, key: string): boolean

    /**
     * Returns true if the given path item is equal to the given index
     *
     * @param {number} item
     * @param {number} index
     * @returns {boolean}
     */
    isIndex(item: number, index: number): boolean

    /**
     * Returns true if the given path item starts with the given key
     *
     * @param {number} item
     * @param {string} key
     * @returns {boolean}
     */
    startsWith(item: number, key: string): boolean

    /**
     * Returns true if the given path item ends with the given key
     *
     * @param {number} item
     * @param {string} key
     * @returns {boolean}
     */
    endsWith(item: number, key: string): boolean
}

export interface Options {
    /**
     * Called before parsing a value, if it returns true the value will be skipped,
     * it will still be parsed but won't be created and no other callback will be called on it
     *
     * @param {Path} path
     * @returns {boolean}
     */
    ignore?(path: Path): boolean

    /**
     * Called before parsing a value, if it returns true the raw json string value will be used,
     * it will still be parsed but won't be created as a JS value and no callback will be called on its children.
     * The transform and drop callbacks will be called with the raw value
     *
     * @param {Path} path
     * @returns {boolean}
     */
    raw?(path: Path): boolean

    /**
     * Called after parsing a value, the returned value will be saved into the parent
     *
     * @param {Path} path
     * @param {T} value
     * @returns {U}
     */
    transform?<T = unknown>(path: Path, value: T): unknown

    /**
     * Called after transform, if it returns true the value won't be saved into the parent,
     * potentially freeing it for garbage collection
     *
     * @param {Path} path
     * @param {T} value
     * @returns {boolean}
     */
    drop?<T = unknown>(path: Path, value: T): boolean
}

export interface Parser {
    /**
     * Parse a chunk of JSON data
     *
     * @param {ArrayLike<number>} buffer A byte array
     * @throws {RangeError} If the parser is in an error or end state
     * @throws {SyntaxError} If there is a syntax error
     */
    write(chunk: Uint8Array): void

    /**
     * Finish parsing the JSON document and return the result
     *
     * @returns {T} The parsed (and potentially tranformed) JSON document
     * @throws {RangeError} If the parser is in an error or end state
     * @throws {SyntaxError} If the parser is in a non-terminal state (early end of file)
     */
    end<T = any>(): T
}

const CLASS_COUNT = 36,
    STATE_COUNT = 30,
    N_SHIFT = 6,
    I_SHIFT = 12,
    P_SHIFT = 18,
    MASK = 0b111111,
    END = (2 << 29) + 1

// prettier-ignore
const enum C {
    ERR     = ' ', UTF_B   = '!', UTF_1   = '"', UTF_2   = '#',
    UTF_3   = '$', CHR     = '%', DIGIT   = '&', COLON   = "'",
    SPACE   = '(', HEX_H   = ')', HEX_L   = '*', OBJ_L   = '+',
    OBJ_R   = ',', ARR_L   = '-', ARR_R   = '.', WS      = '/',
    COMMA   = '0', QUOTE   = '1', CHR_A   = '2', CHR_B   = '3',
    CHR_E   = '4', CHR_F   = '5', CHR_L   = '6', CHR_N   = '7',
    CHR_R   = '8', CHR_S   = '9', CHR_T   = ':', CHR_U   = ';',
    ESC     = '<', SLASH   = '=', ZERO    = '>', DOT     = '?',
    PLUS    = '@', MINUS   = 'A', EXP     = 'B', END     = 'C',
}

// prettier-ignore
const enum S {
    VAL     = ' ', END     = '!', OBJ     = '"', O_KEY   = '#',
    O_SEP   = '$', O_NEXT  = '%', ARR     = '&', A_NEXT  = "'",
    STR     = '(', S_U     = ')', ESC     = '*', ESC_U   = '+',
    N_MINUS = ',', N_ZERO  = '-', N_INT   = '.', N_FRAC  = '/',
    N_E_DIG = '0', N_DOT   = '1', N_E     = '2', N_E_SIG = '3',
    TRUE_T  = '4', TRUE_R  = '5', TRUE_U  = '6', FALSE_F = '7',
    FALSE_A = '8', FALSE_L = '9', FALSE_S = ':', NULL_N  = ';',
    NULL_U  = '<', NULL_L  = '=', DONE    = '>', ERR     = '?',
}

// prettier-ignore
const enum A {
    RECORD  = ' ', ERR     = '!', POP_PAR = '"', FLAG    = '#',
    O_INI   = '$', O_IGN   = '%', A_INI   = '&', A_INCR  = "'",
    S_INI   = '(', S_ADD   = ')', S_U_INI = '*', S_U     = '+',
    ESC     = ',', ESC_U   = '-', S_POP   = '.', N_INI   = '/',
    N_POP   = '0', POP     = '1', I_FLAG  = '2', I_INI   = '3',
    I_U_INI = '4', I_U     = '5', I_POP   = '6', I_POP_S = '7',
    I_POP_N = '8', NONE    = '9'
}

// prettier-ignore
const enum Ss {
    VAL,           END,           OBJ,           O_KEY,
    O_SEP,         O_NEXT,        ARR,           A_NEXT,
    STR,           S_U,           ESC,           ESC_U,
    N_MINUS,       N_ZERO,        N_INT,         N_FRAC,
    N_E_DIG,       N_DOT,         N_E,           N_E_SIG,
    TRUE_T,        TRUE_R,        TRUE_U,        FALSE_F,
    FALSE_A,       FALSE_L,       FALSE_S,       NULL_N,
    NULL_U,        NULL_L,        DONE,          ERR,
}

// prettier-ignore
const enum Aa {
    RECORD,        ERR,           POP_PAR,       FLAG,
    O_INI,         O_IGN,         A_INI,         A_INCR,
    S_INI,         S_ADD,         S_U_INI,       S_U,
    ESC,           ESC_U,         S_POP,         N_INI,
    N_POP,         POP,           I_FLAG,        I_INI,
    I_U_INI,       I_U,           I_POP,         I_POP_S,
    I_POP_N,       NONE
}

const decodeByte = (s: string, i: number) => s.charCodeAt(i) - 0x20

// prettier-ignore
const CLASSES = Uint8Array.from('' +
    C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   +
    C.ERR   + C.WS    + C.WS    + C.ERR   + C.ERR   + C.WS    + C.ERR   + C.ERR   +
    C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   +
    C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   +
    C.SPACE + C.CHR   + C.QUOTE + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   +
    C.CHR   + C.CHR   + C.CHR   + C.PLUS  + C.COMMA + C.MINUS + C.DOT   + C.SLASH +
    C.ZERO  + C.DIGIT + C.DIGIT + C.DIGIT + C.DIGIT + C.DIGIT + C.DIGIT + C.DIGIT +
    C.DIGIT + C.DIGIT + C.COLON + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   +
    C.CHR   + C.HEX_H + C.HEX_H + C.HEX_H + C.HEX_H + C.EXP   + C.HEX_H + C.CHR   +
    C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   +
    C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR   +
    C.CHR   + C.CHR   + C.CHR   + C.ARR_L + C.ESC   + C.ARR_R + C.CHR   + C.CHR   +
    C.CHR   + C.CHR_A + C.CHR_B + C.HEX_L + C.HEX_L + C.CHR_E + C.CHR_F + C.CHR   +
    C.CHR   + C.CHR   + C.CHR   + C.CHR   + C.CHR_L + C.CHR   + C.CHR_N + C.CHR   +
    C.CHR   + C.CHR   + C.CHR_R + C.CHR_S + C.CHR_T + C.CHR_U + C.CHR   + C.CHR   +
    C.CHR   + C.CHR   + C.CHR   + C.OBJ_L + C.CHR   + C.OBJ_R + C.CHR   + C.CHR   +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B + C.UTF_B +
    C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 +
    C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 +
    C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 +
    C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 + C.UTF_1 +
    C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 +
    C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 + C.UTF_2 +
    C.UTF_3 + C.UTF_3 + C.UTF_3 + C.UTF_3 + C.UTF_3 + C.UTF_3 + C.UTF_3 + C.UTF_3 +
    C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   + C.ERR   +
    C.END, (c) => decodeByte(c, 0))

// prettier-ignore
const TABLE = Int32Array.from((

    // S.VAL
    C.OBJ_L + S.OBJ + A.O_INI + A.I_INI + '!' /* 1 */ + '~' +
    C.ARR_L + S.ARR + A.A_INI + A.I_INI + ' ' /* 0 */ + '~' +
    C.QUOTE + S.STR + A.S_INI + '~' +
    C.MINUS + S.N_MINUS + A.N_INI + '~' +
    C.ZERO + S.N_ZERO + A.N_INI + '~' +
    C.DIGIT + S.N_INT + A.N_INI + '~' +
    C.CHR_T + S.TRUE_T + A.NONE + '~' +
    C.CHR_F + S.FALSE_F + A.NONE + '~' +
    C.CHR_N + S.NULL_N + A.NONE + '~' +
    C.SPACE + S.VAL + A.NONE + A.NONE + '~' +
    C.WS + S.VAL + A.NONE + A.NONE + '}' +

    // S.END
    C.SPACE + S.END + A.NONE + '~' +
    C.WS + S.END + A.NONE + A.NONE + '~' +
    C.END + S.DONE + A.NONE + A.NONE + '}' +

    // S.OBJ
    C.OBJ_R + S.ERR + A.POP_PAR + A.I_POP + '#' /* 3 */ + '~' +
    C.QUOTE + S.STR + A.FLAG + A.I_FLAG + '~' +
    C.SPACE + S.OBJ + A.NONE + A.NONE + '~' +
    C.WS + S.OBJ + A.NONE + A.NONE + '}' +

    // S.O_KEY
    C.QUOTE + S.STR + A.FLAG + A.I_FLAG + '~' +
    C.SPACE + S.O_KEY + A.NONE + A.NONE + '~' +
    C.WS + S.O_KEY + A.NONE + A.NONE + '}' +

    // S.O_SEP
    C.COLON + S.VAL + A.O_IGN + '~' +
    C.SPACE + S.O_SEP + A.NONE + A.NONE + '~' +
    C.WS + S.O_SEP + A.NONE + A.NONE + '}' +

    // S.O_NEXT
    C.OBJ_R + S.ERR + A.POP_PAR + A.I_POP + '#' /* 3 */ + '~' +
    C.COMMA + S.O_KEY + A.NONE + '~' +
    C.SPACE + S.O_NEXT + A.NONE + A.NONE + '~' +
    C.WS + S.O_NEXT + A.NONE + A.NONE + '}' +

    // S.ARR
    C.ARR_R + S.ERR + A.POP_PAR + A.I_POP + '#' /* 3 */ + '~' +
    C.OBJ_L + S.OBJ + A.O_INI + A.I_INI + '!' /* 1 */ + '~' +
    C.ARR_L + S.ARR + A.A_INI + A.I_INI + ' ' /* 0 */ + '~' +
    C.QUOTE + S.STR + A.S_INI + '~' +
    C.MINUS + S.N_MINUS + A.N_INI + '~' +
    C.ZERO + S.N_ZERO + A.N_INI + '~' +
    C.DIGIT + S.N_INT + A.N_INI + '~' +
    C.CHR_T + S.TRUE_T + A.NONE + '~' +
    C.CHR_F + S.FALSE_F + A.NONE + '~' +
    C.CHR_N + S.NULL_N + A.NONE + '~' +
    C.SPACE + S.ARR + A.NONE + A.NONE + '~' +
    C.WS + S.ARR + A.NONE + A.NONE + '}' +

    // S.A_NEXT
    C.ARR_R + S.ERR + A.POP_PAR + A.I_POP + '#' /* 3 */ + '~' +
    C.COMMA + S.VAL + A.A_INCR + '~' +
    C.SPACE + S.A_NEXT + A.NONE + A.NONE + '~' +
    C.WS + S.A_NEXT + A.NONE + A.NONE + '}' +

    // S.STR
    C.QUOTE + S.ERR + A.S_POP + A.I_POP_S + '~' +
    C.SPACE + S.STR + A.S_ADD + '~' +
    C.CHR + S.STR + A.S_ADD + '~' +
    C.COMMA + S.STR + A.S_ADD + '~' +
    C.DOT + S.STR + A.S_ADD + '~' +
    C.SLASH + S.STR + A.S_ADD + '~' +
    C.ZERO + S.STR + A.S_ADD + '~' +
    C.DIGIT + S.STR + A.S_ADD + '~' +
    C.COLON + S.STR + A.S_ADD + '~' +
    C.HEX_H + S.STR + A.S_ADD + '~' +
    C.HEX_L + S.STR + A.S_ADD + '~' +
    C.EXP + S.STR + A.S_ADD + '~' +
    C.ARR_L + S.STR + A.S_ADD + '~' +
    C.ESC + S.ESC + A.NONE + '~' +
    C.ARR_R + S.STR + A.S_ADD + '~' +
    C.CHR_A + S.STR + A.S_ADD + '~' +
    C.CHR_B + S.STR + A.S_ADD + '~' +
    C.CHR_E + S.STR + A.S_ADD + '~' +
    C.CHR_F + S.STR + A.S_ADD + '~' +
    C.CHR_L + S.STR + A.S_ADD + '~' +
    C.CHR_N + S.STR + A.S_ADD + '~' +
    C.CHR_R + S.STR + A.S_ADD + '~' +
    C.CHR_S + S.STR + A.S_ADD + '~' +
    C.CHR_T + S.STR + A.S_ADD + '~' +
    C.CHR_U + S.STR + A.S_ADD + '~' +
    C.OBJ_L + S.STR + A.S_ADD + '~' +
    C.OBJ_R + S.STR + A.S_ADD + '~' +
    C.PLUS + S.STR + A.S_ADD + '~' +
    C.MINUS + S.STR + A.S_ADD + '~' +
    C.UTF_1 + S.S_U + A.S_U_INI + A.I_U_INI + ' ' /* 0 */ + '~' +
    C.UTF_2 + S.S_U + A.S_U_INI + A.I_U_INI + '!' /* 1 */ + '~' +
    C.UTF_3 + S.S_U + A.S_U_INI + A.I_U_INI + '"' /* 2 */ + '}' +

    // S.S_U
    C.UTF_B + S.S_U + A.S_U + A.I_U + '}' +

    // S.ESC
    C.QUOTE + S.STR + A.S_ADD + '~' +
    C.ESC + S.STR + A.S_ADD + '~' +
    C.SLASH + S.STR + A.S_ADD + '~' +
    C.CHR_B + S.STR + A.ESC + A.RECORD + '(' /* 0x08 */ + '~' +
    C.CHR_F + S.STR + A.ESC + A.RECORD + ',' /* 0x0c */ + '~' +
    C.CHR_N + S.STR + A.ESC + A.RECORD + '*' /* 0x0a */ + '~' +
    C.CHR_R + S.STR + A.ESC + A.RECORD + '-' /* 0x0d */ + '~' +
    C.CHR_T + S.STR + A.ESC + A.RECORD + ')' /* 0x09 */ + '~' +
    C.CHR_U + S.ESC_U + A.NONE + A.I_U_INI + '#' /* 3 */ + '}' +

    // S.ESC_U
    C.ZERO + S.ESC_U + A.ESC_U + A.I_U + 'P' /* 0x30 */ + '~' +
    C.DIGIT + S.ESC_U + A.ESC_U + A.I_U + 'P' /* 0x30 */ + '~' +
    C.HEX_H + S.ESC_U + A.ESC_U + A.I_U + 'W' /* 0x37 */ + '~' +
    C.EXP + S.ESC_U + A.ESC_U + A.I_U + 'W' /* 0x37 */ + '~' +
    C.HEX_L + S.ESC_U + A.ESC_U + A.I_U + 'w' /* 0x57 */ + '~' +
    C.CHR_A + S.ESC_U + A.ESC_U + A.I_U + 'w' /* 0x57 */ + '~' +
    C.CHR_B + S.ESC_U + A.ESC_U + A.I_U + 'w' /* 0x57 */ + '~' +
    C.CHR_E + S.ESC_U + A.ESC_U + A.I_U + 'w' /* 0x57 */ + '~' +
    C.CHR_F + S.ESC_U + A.ESC_U + A.I_U + 'w' /* 0x57 */ + '}' +

    // S.N_MINUS
    C.ZERO + S.N_ZERO + A.S_ADD + '~' +
    C.DIGIT + S.N_INT + A.S_ADD + '}' +

    // S.N_ZERO
    C.DOT + S.N_DOT + A.S_ADD + '~' +
    C.CHR_E + S.N_E + A.S_ADD + '~' +
    C.EXP + S.N_E + A.S_ADD + '}' +

    // S.N_INT
    C.ZERO + S.N_INT + A.S_ADD + '~' +
    C.DIGIT + S.N_INT + A.S_ADD + '~' +
    C.DOT + S.N_DOT + A.S_ADD + '~' +
    C.CHR_E + S.N_E + A.S_ADD + '~' +
    C.EXP + S.N_E + A.S_ADD + '}' +

    // S.N_FRAC
    C.ZERO + S.N_FRAC + A.S_ADD + '~' +
    C.DIGIT + S.N_FRAC + A.S_ADD + '~' +
    C.CHR_E + S.N_E + A.S_ADD + '~' +
    C.EXP + S.N_E + A.S_ADD + '}' +

    // S.N_E_DIG
    C.ZERO + S.N_E_DIG + A.S_ADD + '~' +
    C.DIGIT + S.N_E_DIG + A.S_ADD + '}' +

    // S.N_DOT
    C.ZERO + S.N_FRAC + A.S_ADD + '~' +
    C.DIGIT + S.N_FRAC + A.S_ADD + '}' +

    // S.N_E
    C.ZERO + S.N_E_DIG + A.S_ADD + '~' +
    C.DIGIT + S.N_E_DIG + A.S_ADD + '~' +
    C.PLUS + S.N_E_SIG + A.S_ADD + '~' +
    C.MINUS + S.N_E_SIG + A.S_ADD + '}' +

    // S.N_E_SIG
    C.ZERO + S.N_E_DIG + A.S_ADD + '~' +
    C.DIGIT + S.N_E_DIG + A.S_ADD + '}' +

    // S.TRUE_T
    C.CHR_R + S.TRUE_R + A.NONE + '}' +

    // S.TRUE_R
    C.CHR_U + S.TRUE_U + A.NONE + '}' +

    // S.TRUE_U
    C.CHR_E + S.ERR + A.POP + A.I_POP + '!' /* 1 */ + '}' +

    // S.FALSE_F
    C.CHR_A + S.FALSE_A + A.NONE + '}' +

    // S.FALSE_A
    C.CHR_L + S.FALSE_L + A.NONE + '}' +

    // S.FALSE_L
    C.CHR_S + S.FALSE_S + A.NONE + '}' +

    // S.FALSE_S
    C.CHR_E + S.ERR + A.POP + A.I_POP + ' ' /* 0 */ + '}' +

    // S.NULL_N
    C.CHR_U + S.NULL_U + A.NONE + '}' +

    // S.NULL_U
    C.CHR_L + S.NULL_L + A.NONE + '}' +

    // S.NULL_L
    C.CHR_L + S.ERR + A.POP + A.I_POP + '"' /* 2 */

).split('}').flatMap((transition, i) => {
    const a = Array(CLASS_COUNT).fill(
        i >= Ss.N_ZERO && i <= Ss.N_E_DIG
            ? (Aa.N_POP << N_SHIFT) | (Aa.I_POP_N << I_SHIFT)
            : (Aa.ERR << N_SHIFT) | (Aa.ERR << I_SHIFT)
    )

    transition.split('~').forEach((edge) => {
        a[decodeByte(edge, 0)] =
            decodeByte(edge, 1) |
            (decodeByte(edge, 2) << N_SHIFT) |
            (decodeByte(edge, 3) << I_SHIFT) |
            (decodeByte(edge, 4) << P_SHIFT)
    })

    return a
}))

// eslint-disable-next-line prefer-spread
const decode = (codes: number[]) => String.fromCharCode.apply(String, codes)

const f = () => false

/**
 * Create a JSON streaming parser with the given options
 *
 * @param {Options} options
 * @returns {Parser}
 */
export const parser = (options: Options): Parser => {
    let state = Ss.VAL
    let i = 0
    let parent: any = null
    let val: any = null

    let flag = 0
    let record = 0
    let num = 0
    let counter = 0
    let cursor = 0
    let shift = N_SHIFT

    const ignore = options.ignore || f
    const raw = options.raw || f
    const transform = options.transform || ((_, v) => v)
    const drop = options.drop || f

    const values: any[] = []
    const meta: number[] = []
    const buffer: number[] = []

    const compare = (key: string, start: number) => {
        for (let i = 0; i < key.length; i++) {
            if (buffer[start + i + 1] !== key.charCodeAt(i)) {
                return false
            }
        }

        return true
    }

    const path: Path = {
        length() {
            return meta.length
        },

        isKey(item, key) {
            return (
                item < meta.length &&
                (item = meta[item]) >= 0 &&
                buffer[item] === key.length &&
                compare(key, item)
            )
        },

        isIndex(item, index) {
            return item < meta.length && meta[item] === -(index + 1)
        },

        startsWith(item, key) {
            return (
                item < meta.length &&
                (item = meta[item]) >= 0 &&
                buffer[item] >= key.length &&
                compare(key, item)
            )
        },

        endsWith(item, key) {
            return (
                item < meta.length &&
                (item = meta[item]) >= 0 &&
                buffer[item] >= key.length &&
                compare(key, item + buffer[item] - key.length)
            )
        },
    }

    const accept = () => {
        val = transform(path, val)

        if (meta.length === 0) {
            if (drop(path, val)) {
                val = null
            }

            state = Ss.END
        } else if ((cursor = meta[meta.length - 1]) < 0) {
            if (!drop(path, val)) {
                parent.push(val)
            }

            state = Ss.A_NEXT
        } else {
            if (!drop(path, val)) {
                parent[decode(buffer.splice(cursor + 1))] = val
            } else {
                buffer.splice(cursor + 1)
            }

            state = Ss.O_NEXT
        }
    }

    const checkIgnore = () => {
        if (ignore(path)) {
            shift = I_SHIFT
            cursor = meta.length
        } else if (raw(path)) {
            meta.push(buffer.length)
            shift = I_SHIFT
            cursor = meta.length
            record = 1
        }
    }

    const acceptIgnore = () => {
        if (meta.length === cursor) {
            shift = N_SHIFT

            if (record) {
                val = Uint8Array.from(buffer.splice(meta.pop()!))
                record = 0
                accept()
            } else if ((cursor = meta[meta.length - 1]) >= 0) {
                buffer.splice(cursor + 1)
            }
        }

        state = meta[meta.length - 1] < 0 ? Ss.A_NEXT : Ss.O_NEXT
    }

    const recordByte = (byte: number) => {
        record && buffer.push(byte)
    }

    const parseByte = (byte: number) => {
        const transition = TABLE[state * CLASS_COUNT + CLASSES[byte]]
        const action = (transition >> shift) & MASK

        state = transition & MASK

        if (action === Aa.RECORD) {
            recordByte(byte)
        } else if (action === Aa.ERR) {
            cursor = i
            i = END
            state = Ss.ERR
        } else if (action === Aa.POP_PAR) {
            val = parent
            parent = values.pop()!

            if ((cursor = meta.pop()!) >= 0) {
                buffer.splice(cursor)
            }

            accept()
        } else if (action === Aa.FLAG) {
            flag = 1
        } else if (action === Aa.O_INI) {
            values.push(parent)
            parent = {}
            meta.push(buffer.length)
            buffer.push(0)
        } else if (action === Aa.O_IGN) {
            checkIgnore()
        } else if (action === Aa.A_INI) {
            values.push(parent)
            parent = []
            meta.push(-1)
            checkIgnore()
        } else if (action === Aa.A_INCR) {
            meta[meta.length - 1]--
            checkIgnore()
        } else if (action === Aa.S_INI) {
            cursor = buffer.length
        } else if (action === Aa.S_ADD) {
            buffer.push(byte)
        } else if (action === Aa.S_U_INI) {
            counter = transition >> P_SHIFT
            num = byte - ((0x3c0 >> counter) & 0xff)
        } else if (action === Aa.S_U) {
            num = (num << 6) + byte - 0x80

            if (counter === 0) {
                if (num >= 0x10000) {
                    num -= 0x10000
                    buffer.push(0xd800 + (num >> 10), 0xdc00 + (num & 0x3ff))
                } else {
                    buffer.push(num)
                }

                num = 0
                state = Ss.STR
            } else {
                counter--
            }
        } else if (action === Aa.ESC) {
            buffer.push(transition >> P_SHIFT)
        } else if (action === Aa.ESC_U) {
            num = (num << 4) + byte - (transition >> P_SHIFT)

            if (counter === 3) {
                buffer.push(num)

                num = counter = 0
                state = Ss.STR
            } else {
                counter++
            }
        } else if (action === Aa.S_POP) {
            if (flag) {
                cursor = meta[meta.length - 1]
                buffer[cursor] = buffer.length - cursor - 1

                flag = 0
                state = Ss.O_SEP
            } else {
                val = decode(buffer.splice(cursor))
                accept()
            }
        } else if (action === Aa.N_INI) {
            cursor = buffer.length
            buffer.push(byte)
        } else if (action === Aa.N_POP) {
            val = parseFloat(decode(buffer.splice(cursor)))
            i--
            accept()
        } else if (action === Aa.POP) {
            val = (val = transition >> P_SHIFT) === 2 ? null : !!val
            accept()
        } else if (action === Aa.I_FLAG) {
            recordByte(byte)
            flag = 1
        } else if (action === Aa.I_INI) {
            recordByte(byte)
            meta.push((transition >> P_SHIFT) - 1)
        } else if (action === Aa.I_U_INI) {
            recordByte(byte)
            counter = transition >> P_SHIFT
        } else if (action === Aa.I_U) {
            recordByte(byte)
            if (counter === 0) {
                state = Ss.STR
            } else {
                counter--
            }
        } else if (action === Aa.I_POP) {
            recordByte(byte)
            if (transition >> P_SHIFT === 3) {
                meta.pop()!
            }
            acceptIgnore()
        } else if (action === Aa.I_POP_S) {
            recordByte(byte)
            if (flag) {
                flag = 0
                state = Ss.O_SEP
            } else {
                acceptIgnore()
            }
        } else if (action === Aa.I_POP_N) {
            i--
            acceptIgnore()
        }
    }

    const checkState = () => {
        if (state >= STATE_COUNT) {
            throw RangeError('Invalid state')
        }
    }

    return {
        write(chunk: ArrayLike<number>): void {
            checkState()

            for (i = 0; i < chunk.length; i++) {
                parseByte(chunk[i])
            }

            if (state === Ss.ERR) {
                throw SyntaxError(
                    'Error byte ' +
                        cursor +
                        ' (' +
                        decode([chunk[cursor]]) +
                        '): "' +
                        decode(Array.from(chunk)) +
                        '"'
                )
            }
        },

        end<T = any>(): T {
            checkState()

            for (i = 0; i < 1; i++) {
                parseByte(256)
            }

            if (state !== Ss.DONE) {
                throw SyntaxError('Reached EOF')
            }

            return val
        },
    }
}
