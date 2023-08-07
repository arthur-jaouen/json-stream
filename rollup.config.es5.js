import { terser } from 'rollup-plugin-terser'
import { babel } from '@rollup/plugin-babel'
import sourcemaps from 'rollup-plugin-sourcemaps'

export default {
    input: 'dist/json-stream.min.esm.js',
    output: [
        {
            file: 'dist/json-stream.min.umd.js',
            format: 'umd',
            name: '@ja-ja/json-stream',
            sourcemap: true,
            plugins: [terser({ ecma: 5 })],
        },
        {
            file: 'dist/json-stream.min.browser.js',
            format: 'iife',
            name: 'JsonStream',
            sourcemap: true,
            plugins: [terser({ ecma: 5 })],
        },
    ],
    plugins: [
        sourcemaps(),
        babel({
            presets: ['@babel/env'],
            babelHelpers: 'bundled',
            inputSourceMap: false,
        }),
    ],
}
