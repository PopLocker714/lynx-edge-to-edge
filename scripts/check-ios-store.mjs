import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

mkdirSync('artifacts/ios', { recursive: true })
execFileSync(
    'xcrun',
    [
        'clang',
        '-fobjc-arc',
        '-fblocks',
        '-Wall',
        '-Wextra',
        '-Werror',
        '-framework',
        'Foundation',
        '-framework',
        'CoreGraphics',
        '-Itest/native-ios/include',
        '-Iios/src',
        'ios/src/LEESafeAreaStore.m',
        'test/native-ios/safe-area-store.m',
        '-o',
        'artifacts/ios/state-store-tests',
    ],
    { stdio: 'inherit' }
)
execFileSync('artifacts/ios/state-store-tests', [], { stdio: 'inherit' })
console.log('macOS deterministic store tests use UIKit/Lynx adapters; this is not iOS device QA')
