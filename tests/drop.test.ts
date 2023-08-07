import { atoms, strings } from './utils/data'
import { runTest } from './utils/utils'

for (const atom of atoms.concat(strings)) {
    const parsed = JSON.parse(atom)

    describe(`${atom}`, () => {
        runTest('drop root', `{"a":${atom},"b":${atom}}`, { drop: () => true }, null)

        runTest(
            'drop entries',
            `{"a":${atom},"b":${atom}}`,
            { drop: (path) => path.length() > 0 },
            {}
        )

        runTest('drop entries', `[${atom},${atom}]`, { drop: (path) => path.length() > 0 }, [])

        runTest(
            'drop nested',
            `{"a":[${atom}],"b":{"c":${atom}}}`,
            { drop: (path) => path.length() > 1 },
            { a: [], b: {} }
        )

        runTest('drop nested', `[[${atom}],{"a":${atom}}]`, { drop: (path) => path.length() > 1 }, [
            [],
            {},
        ])

        runTest(
            'drop entry',
            `{"a":${atom},"b":${atom}}`,
            { drop: (path) => path.length() === 1 && path.isKey(0, 'a') },
            { b: parsed }
        )

        runTest(
            'drop entry',
            `[${atom},${atom}]`,
            {
                drop: (path) => path.length() === 1 && path.isIndex(0, 0),
            },
            [parsed]
        )
    })
}
