import path from 'path'

const config = {
    target: 'web',
    entry: {
        'json-stream': './dist/json-stream.js',
    },
    output: {
        path: path.resolve('./dist'),
        filename: '[name].min.js',
        library: { name: '@ja-ja/json-stream', type: 'umd', umdNamedDefine: true },
    },
    resolve: {
        extensions: ['.js'],
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            sourceMap: true,
                            cacheDirectory: true,
                        },
                    },
                ],
            },
        ],
    },
    stats: {
        children: false,
        modules: false,
    },
}

export default (_env, argv) => {
    const mode = argv.mode
    const devtool = mode === 'development' ? 'cheap-module-source-map' : 'source-map'
    const performance =
        mode === 'development'
            ? undefined
            : {
                  maxEntrypointSize: 8 * 1024,
                  maxAssetSize: 8 * 1024,
              }

    const base = {
        ...config,
        mode,
        devtool,
        performance,
    }

    const modules = {
        ...base,
        experiments: {
            outputModule: true,
        },
        output: {
            ...base.output,
            filename: '[name].min.mjs',
            library: { type: 'module' },
        },
    }

    return [base, modules]
}
