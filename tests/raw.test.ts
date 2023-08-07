import { atoms, strings } from './utils/data'
import { runTest } from './utils/utils'

for (const atom of atoms.concat(strings)) {
    const parsed = JSON.parse(atom)
    const raw = new TextEncoder().encode(atom)

    describe(`${atom}`, () => {
        runTest('raw entries', `{"a":${atom},"b":${atom}}`, { raw: () => true }, { a: raw, b: raw })

        runTest('raw entries', `[${atom},${atom}]`, { raw: () => true }, [raw, raw])

        runTest(
            'raw nested',
            `{"a":[${atom}],"b":{"c":${atom}}}`,
            { raw: (path) => path.length() > 1 },
            { a: [raw], b: { c: raw } }
        )

        runTest('raw nested', `[[${atom}],{"a":${atom}}]`, { raw: (path) => path.length() > 1 }, [
            [raw],
            { a: raw },
        ])

        runTest(
            'raw entry',
            `{"a":${atom},"b":${atom}}`,
            { raw: (path) => path.length() === 1 && path.isKey(0, 'a') },
            { a: raw, b: parsed }
        )

        runTest(
            'raw entry',
            `[${atom},${atom}]`,
            { raw: (path) => path.length() === 1 && path.isIndex(0, 0) },
            [raw, parsed]
        )
    })
}
