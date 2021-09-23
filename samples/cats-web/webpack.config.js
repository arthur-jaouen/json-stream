import path from 'path'
import HtmlWebpackPlugin from 'html-webpack-plugin'

const config = {
    target: 'web',
    entry: {
        index: './index',
    },
    output: {
        path: path.resolve('./dist'),
        publicPath: '',
        filename: '[name].[contenthash].js',
        chunkFilename: '[name].[contenthash].js',
    },
    resolve: {
        extensions: ['.js', '.mjs'],
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
    plugins: [
        new HtmlWebpackPlugin({
            output: 'index.html',
            template: 'index.html',
        }),
    ],
    stats: {
        children: false,
        modules: false,
    },
}

export default (_env, argv) => {
    const mode = argv.mode
    const devtool = mode === 'development' ? 'cheap-module-source-map' : 'source-map'

    return { ...config, mode, devtool }
}
