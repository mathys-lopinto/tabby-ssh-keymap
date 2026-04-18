import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'
import wp from 'webpack'
import { AngularWebpackPlugin } from '@ngtools/webpack'
import { createEs2015LinkerPlugin } from '@angular/compiler-cli/linker/babel'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const linkerPlugin = createEs2015LinkerPlugin({
    linkerJitMode: true,
    fileSystem: {
        resolve: path.resolve,
        exists: fs.existsSync,
        dirname: path.dirname,
        relative: path.relative,
        readFile: fs.readFileSync,
    },
})

export default () => {
    const isDev = !!process.env.TABBY_DEV

    const sourceMapOptions = {
        exclude: [/node_modules/, /vendor/],
        filename: '[file].map',
        moduleFilenameTemplate: 'webpack-tabby-ssh-keymap:///[resource-path]',
    }
    const devtoolPlugin = (process.platform === 'win32' || process.platform === 'linux') && isDev
        ? wp.EvalSourceMapDevToolPlugin
        : wp.SourceMapDevToolPlugin

    return {
        target: 'node',
        entry: 'src/index.ts',
        context: __dirname,
        devtool: false,
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'index.js',
            pathinfo: true,
            libraryTarget: 'umd',
            publicPath: 'auto',
        },
        mode: isDev ? 'development' : 'production',
        optimization: {
            minimize: false,
        },
        resolve: {
            modules: ['.', 'src', 'node_modules'].map(x => path.join(__dirname, x)),
            extensions: ['.ts', '.js'],
            mainFields: ['esm2015', 'browser', 'module', 'main'],
        },
        ignoreWarnings: [/Failed to parse source map/],
        module: {
            rules: [
                {
                    test: /\.js$/,
                    enforce: 'pre',
                    use: {
                        loader: 'source-map-loader',
                        options: {
                            filterSourceMappingUrl: (_url, resourcePath) => !/node_modules/.test(resourcePath),
                        },
                    },
                },
                {
                    test: /\.(m?)js$/,
                    loader: 'babel-loader',
                    options: {
                        plugins: [linkerPlugin],
                        compact: false,
                        cacheDirectory: true,
                    },
                    resolve: { fullySpecified: false },
                },
                {
                    test: /\.ts$/,
                    use: [{ loader: '@ngtools/webpack' }],
                },
                {
                    test: /\.pug$/,
                    use: [
                        'apply-loader',
                        { loader: 'pug-loader', options: { pretty: true } },
                    ],
                },
                { test: /\.scss$/, use: ['@tabby-gang/to-string-loader', 'css-loader', 'sass-loader'], include: /(theme.*|component)\.scss/ },
                { test: /\.scss$/, use: ['style-loader', 'css-loader', 'sass-loader'], exclude: /(theme.*|component)\.scss/ },
                { test: /\.css$/, use: ['@tabby-gang/to-string-loader', 'css-loader'], include: /component\.css/ },
                { test: /\.css$/, use: ['style-loader', 'css-loader'], exclude: /component\.css/ },
                { test: /\.yaml$/, use: ['yaml-loader'] },
                { test: /\.svg/, use: ['svg-inline-loader'] },
            ],
        },
        externals: [
            '@electron/remote',
            'child_process',
            'electron',
            'fs',
            'net',
            'os',
            'path',
            'readline',
            'russh',
            'stream',
            'ngx-toastr',
            /^@angular(?!\/common\/locales)/,
            /^@ng-bootstrap/,
            /^rxjs/,
            /^tabby-/,
        ],
        plugins: [
            new devtoolPlugin(sourceMapOptions),
            new AngularWebpackPlugin({
                tsconfig: path.resolve(__dirname, 'tsconfig.json'),
                directTemplateLoading: false,
                jitMode: true,
            }),
        ],
    }
}
