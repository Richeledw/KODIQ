module.exports = [
    {
        ignores: ['node_modules/**', 'public/**', 'docs/**', 'scripts/**', 'coverage/**', '.github/**']
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'writable',
                exports: 'writable',
                require: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                Buffer: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            'no-undef': 'error',
            'no-constant-condition': 'warn',
            'no-duplicate-case': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }]
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                test: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly'
            }
        }
    }
];
