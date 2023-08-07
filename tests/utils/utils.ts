import { parser, Options } from '../../src/json-stream'
import { readFile } from 'fs/promises'
import { readdirSync } from 'fs'
import path from 'path'

export function runTest(
    msg: string,
    json: string,
    options: Options = {},
    expected = JSON.parse(json)
) {
    it(msg + ' ' + json, () => {
        const { write, end } = parser(options)

        if (typeof json === 'string') {
            write(new TextEncoder().encode(json))
        } else {
            write(json)
        }

        const result = end()

        expect(result).toEqual(expected)
    })
}

export async function runSuite(name: string) {
    const suite = path.join('./tests/suites', name)
    const files = readdirSync(suite)

    describe('Run suite ' + name, () => {
        for (const file of files) {
            if (file === '.' || file === '..') {
                continue
            }

            const shouldSucceed = !file.startsWith('n_')
            const shouldMatch = file.startsWith('y_')

            it((shouldSucceed ? 'pass' : 'fail') + ' ' + file, async () => {
                const { write, end } = parser({})

                const json = await readFile(path.join(suite, file))

                if (shouldSucceed) {
                    write(json)
                    const result = end()

                    if (shouldMatch) {
                        expect(result).toEqual(JSON.parse(new TextDecoder().decode(json)))
                    }
                } else {
                    expect(() => {
                        write(json)
                        end()
                    }).toThrowError()
                }
            })
        }
    })
}
