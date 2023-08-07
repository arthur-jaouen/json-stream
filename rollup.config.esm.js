import { terser } from 'rollup-plugin-terser'
import sourcemaps from 'rollup-plugin-sourcemaps'

export default {
    input: 'dist/json-stream.js',
    output: [
        {
            file: 'dist/json-stream.min.esm.js',
            format: 'es',
            sourcemap: true,
            plugins: [terser({ ecma: 2020, module: true })],
        },
    ],
    plugins: [sourcemaps()],
}
