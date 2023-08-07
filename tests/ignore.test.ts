import { atoms, strings } from './utils/data'
import { runTest } from './utils/utils'

for (const atom of atoms.concat(strings)) {
    const parsed = JSON.parse(atom)

    describe(`${atom}`, () => {
        runTest('ignore entries', `{"a":${atom},"b":${atom}}`, { ignore: () => true }, {})

        runTest('ignore entries', `[${atom},${atom}]`, { ignore: () => true }, [])

        runTest(
            'ignore nested',
            `{"a":[${atom}],"b":{"c":${atom}}}`,
            { ignore: (path) => path.length() > 1 },
            { a: [], b: {} }
        )

        runTest(
            'ignore nested',
            `[[${atom}],{"a":${atom}}]`,
            { ignore: (path) => path.length() > 1 },
            [[], {}]
        )

        runTest(
            'ignore entry',
            `{"a":${atom},"b":${atom}}`,
            { ignore: (path) => path.length() === 1 && path.isKey(0, 'a') },
            { b: parsed }
        )

        runTest(
            'ignore entry',
            `[${atom},${atom}]`,
            { ignore: (path) => path.length() === 1 && path.isIndex(0, 0) },
            [parsed]
        )
    })
}
