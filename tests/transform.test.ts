import { atoms, strings } from './utils/data'
import { runTest } from './utils/utils'

for (const atom of atoms.concat(strings)) {
    const parsed = JSON.parse(atom)

    describe(`${atom}`, () => {
        runTest(
            'transform root',
            `{"a":${atom},"b":${atom}}`,
            { transform: () => 'transformed' },
            'transformed'
        )

        runTest(
            'transform entries',
            `{"a":[${atom}],"b":{"c":${atom}}}`,
            { transform: (path, value) => (path.length() === 1 ? 'transformed' : value) },
            { a: 'transformed', b: 'transformed' }
        )

        runTest(
            'transform entries',
            `[${atom},${atom}]`,
            { transform: (path, value) => (path.length() === 1 ? 'transformed' : value) },
            ['transformed', 'transformed']
        )

        runTest(
            'transform nested',
            `{"a":[${atom}],"b":{"c":${atom}}}`,
            { transform: (path, value) => (path.length() > 1 ? 'transformed' : value) },
            { a: ['transformed'], b: { c: 'transformed' } }
        )

        runTest(
            'transform nested',
            `[[${atom}],{"b":${atom}}]`,
            { transform: (path, value) => (path.length() > 1 ? 'transformed' : value) },
            [['transformed'], { b: 'transformed' }]
        )

        runTest(
            'transform entry',
            `{"a":${atom},"b":${atom}}`,
            {
                transform: (path, value) =>
                    path.length() === 1 && path.isKey(0, 'a') ? 'transformed' : value,
            },
            { a: 'transformed', b: parsed }
        )

        runTest(
            'transform entry',
            `[${atom},${atom}]`,
            {
                transform: (path, value) =>
                    path.length() === 1 && path.isIndex(0, 0) ? 'transformed' : value,
            },
            ['transformed', parsed]
        )
    })
}
