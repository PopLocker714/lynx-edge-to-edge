import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

mkdirSync('artifacts', { recursive: true })
const examples = mkdtempSync(resolve('artifacts', 'examples-'))
const temporary = mkdtempSync(join(tmpdir(), 'lynx-edge-to-edge-pack-'))
try {
    const suppliedArchive = process.env.RELEASE_TARBALL
    const archive = suppliedArchive ? resolve(suppliedArchive) : join(temporary, 'package.tgz')
    if (!suppliedArchive)
        execFileSync('bun', ['pm', 'pack', '--filename', archive], { stdio: 'inherit' })
    execFileSync('tar', ['-xzf', archive, '-C', temporary])
    const root = join(temporary, 'package')
    const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .map((file) => file.replace(/^package\//, ''))
    const required = [
        'lynx.lib.json',
        'dist/index.js',
        'dist/index.d.ts',
        'src/react/index.tsx',
        'dist/react/index.d.ts',
        'dist/testing/index.js',
        'dist/testing/index.d.ts',
        'android/build.gradle.kts',
        'android/consumer-rules.pro',
        'android/src/main/AndroidManifest.xml',
        'android/src/main/java/dev/lynxlab/edgetoedge/LynxEdgeToEdgeModule.kt',
        'ios/LynxEdgeToEdge.podspec',
        'ios/src/LynxEdgeToEdgeModule.h',
        'ios/src/LynxEdgeToEdgeModule.m',
        'ios/src/LEESafeAreaStore.h',
        'ios/src/LEESafeAreaStore.m',
        'android/src/main/java/dev/lynxlab/edgetoedge/EdgeToEdgeInitProvider.kt',
        'android/src/main/java/dev/lynxlab/edgetoedge/SafeAreaStore.kt',
        'android/src/main/java/dev/lynxlab/edgetoedge/SafeAreaGeometry.kt',
        'android/src/main/java/dev/lynxlab/edgetoedge/EdgeToEdge.kt',
        'LICENSE',
        'README.md',
        'README.ru.md',
        'CONTRIBUTING.md',
        'CONTRIBUTING.ru.md',
    ]
    function checkExports(value) {
        if (typeof value === 'string') {
            if (!value.startsWith('./') || !existsSync(join(root, value))) {
                throw new Error(`Missing export target: ${value}`)
            }
        } else {
            for (const child of Object.values(value)) checkExports(child)
        }
    }
    checkExports(metadata.exports)
    for (const file of required) {
        if (!files.includes(file)) throw new Error(`Missing package file: ${file}`)
    }
    for (const file of files) {
        if (
            /^(?:android\/(?:build|\.gradle)\/|src\/__tests__\/|android\/src\/test\/|test\/|types\/|ios-check\/|android-check\/|\.tools\/|artifacts\/)/.test(
                file
            )
        ) {
            throw new Error(`Development artifact leaked into package: ${file}`)
        }
        if (!file.endsWith('.md')) continue
        if (
            file.startsWith('docs/') &&
            !file.endsWith('.ru.md') &&
            !files.includes(file.replace(/\.md$/, '.ru.md'))
        ) {
            throw new Error(`Missing Russian documentation: ${file}`)
        }
        const markdown = readFileSync(join(root, file), 'utf8')
        for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
            const target = match[1].split('#')[0]
            if (!target || /^(?:https?:|mailto:)/.test(target)) continue
            if (!existsSync(resolve(root, dirname(file), target))) {
                throw new Error(`Broken packaged documentation link: ${file} -> ${target}`)
            }
        }
    }
    const library = JSON.parse(readFileSync(join(root, 'lynx.lib.json'), 'utf8'))
    if (
        library.platforms?.android?.sourceDir !== 'android' ||
        library.platforms?.android?.packageName !== 'dev.lynxlab.edgetoedge' ||
        library.platforms?.ios?.sourceDir !== 'ios' ||
        library.platforms?.ios?.podspecPath !== 'ios/LynxEdgeToEdge.podspec'
    )
        throw new Error('Invalid native autolink metadata')
    const api = await import(pathToFileURL(join(root, 'dist/index.js')).href)
    const testing = await import(pathToFileURL(join(root, 'dist/testing/index.js')).href)
    const originalLynx = Object.getOwnPropertyDescriptor(globalThis, 'lynx')
    const fake = testing.createFakeEdgeToEdge({ native: { top: 24, generation: 1 } })
    try {
        api.setNativeModule(fake)
        if (api.getSafeAreaInsets().top !== 24) throw new Error('Packaged getter failed')
        const seen = []
        const unsubscribe = api.subscribeSafeArea((snapshot) => seen.push(snapshot.insets.top))
        fake.pushGlobalProps({ top: 42, generation: 2 })
        unsubscribe()
        if (seen.join() !== '24,42') throw new Error('Packaged subscription failed')
    } finally {
        api.setNativeModule(null)
        if (originalLynx) Object.defineProperty(globalThis, 'lynx', originalLynx)
        else delete globalThis.lynx
    }
    const exampleFiles = []
    for (const document of ['README.md', 'README.ru.md']) {
        for (const match of readFileSync(join(root, document), 'utf8').matchAll(
            /```(tsx?)\n([\s\S]*?)```/g
        )) {
            const file = join(examples, `example-${exampleFiles.length}.${match[1]}`)
            writeFileSync(file, match[2])
            exampleFiles.push(file)
        }
    }
    const config = join(examples, 'tsconfig.json')
    writeFileSync(
        config,
        JSON.stringify({
            extends: resolve('tsconfig.json'),
            compilerOptions: {
                paths: {
                    '@lynx-lab/edge-to-edge': [join(root, 'dist/index.d.ts')],
                    '@lynx-lab/edge-to-edge/react': [join(root, 'dist/react/index.d.ts')],
                    '@lynx-lab/edge-to-edge/testing': [join(root, 'dist/testing/index.d.ts')],
                    '@lynx-js/react': [resolve('node_modules/@lynx-js/react/types/react.d.ts')],
                    preact: [resolve('node_modules/preact/src/index.d.ts')],
                },
            },
            files: [...exampleFiles, resolve('types/reactlynx-0.125.d.ts')],
            include: [],
            exclude: [],
        })
    )
    execFileSync('bun', [resolve('node_modules/typescript/bin/tsc'), '-p', config], {
        stdio: 'inherit',
    })
    const hash = createHash('sha256').update(readFileSync(archive)).digest('hex')
    mkdirSync('artifacts', { recursive: true })
    const output = suppliedArchive ? archive : resolve('artifacts', `edge-to-edge-${hash}.tgz`)
    if (!suppliedArchive) renameSync(archive, output)
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const dirty =
        execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0
    writeFileSync(
        'artifacts/package-evidence.json',
        `${JSON.stringify({ sourceCommit: suppliedArchive ? null : sourceCommit, inspectorCommit: sourceCommit, mode: suppliedArchive ? 'inspect' : 'pack', dirty, sha256: hash, tarball: output }, null, 4)}\n`
    )
    console.log(`Source: ${sourceCommit}${dirty ? ' (dirty)' : ''}`)
    console.log(`check-publishable: ${files.length} files; SHA256 ${hash}\n${output}`)
} finally {
    rmSync(examples, { recursive: true, force: true })
    rmSync(temporary, { recursive: true, force: true })
}
