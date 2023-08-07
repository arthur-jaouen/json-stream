import { atoms, strings } from './utils/data'
import { runTest } from './utils/utils'

for (const atom of atoms.concat(strings)) {
    describe(`${atom}`, () => {
        runTest('parse', atom)
        runTest('parse', `[${atom}]`)
        runTest('parse', `[${atom},${atom}]`)
        runTest('parse', `[[${atom}]]`)
        runTest('parse', `[[${atom},${atom}],${atom}]`)
        runTest('parse', `{"key":${atom}}`)
        runTest('parse', `{"a":${atom},"b":${atom}}`)
        runTest('parse', `{"a":{"b":${atom}}}`)
        runTest('parse', `{"a":{"b":${atom},"c":${atom}},"d":${atom}}`)

        if (strings.includes(atom)) {
            runTest('parse', `{${atom}:[]}`)
        }
    })
}
