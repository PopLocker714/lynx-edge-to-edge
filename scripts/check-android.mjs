import { execFileSync } from 'node:child_process'
import { checkKotlinFormat } from './native-tools.mjs'

checkKotlinFormat()
execFileSync(
    './android-check/gradlew',
    [
        '-PlynxEdgeStrictChecks=true',
        '-p',
        'android-check',
        ':lynx-edge-to-edge:testDebugUnitTest',
        ':lynx-edge-to-edge:assembleDebug',
        ':lynx-edge-to-edge:assembleRelease',
        ':lynx-edge-to-edge:lintDebug',
        ':lynx-edge-to-edge:lintRelease',
        '--no-daemon',
        '--stacktrace',
    ],
    { stdio: 'inherit' }
)
