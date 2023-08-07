import { open } from 'node:fs/promises'
import { createReadStream } from 'fs'
import { parser } from '@ja-ja/json-stream'

const PARSER_OPTIONS = {
    drop: (path, value) =>
        path.length() === 2 && path.isKey(0, 'features') && value.properties.ST_TYPE !== 'AVE',
}

async function getFeaturesOnAvenuesPromise() {
    const file = await open(new URL('../../data/large-file.json', import.meta.url))

    const { write, end } = parser(PARSER_OPTIONS)

    const buffer = new Uint8Array(1024)

    let res = await file.read({ buffer })
    while (res.bytesRead > 0) {
        write(buffer.subarray(0, res.bytesRead))

        res = await file.read({ buffer })
    }

    file.close()

    return end()
}

getFeaturesOnAvenuesPromise().then(console.log)

function getFeaturesOnAvenuesStream() {
    return new Promise((resolve, reject) => {
        const stream = createReadStream(new URL('../../data/large-file.json', import.meta.url))

        const { write, end } = parser(PARSER_OPTIONS)

        function onAbort() {
            onClose()
            reject(new Error('Aborted'))
        }

        function onData(buffer) {
            write(buffer)
        }

        function onEnd() {
            onClose()
            resolve(end())
        }

        function onError(error) {
            onClose()
            reject(error)
        }

        function onClose() {
            stream.removeListener('aborted', onAbort)
            stream.removeListener('data', onData)
            stream.removeListener('end', onEnd)
            stream.removeListener('error', onError)
            stream.removeListener('close', onClose)
        }

        stream.on('aborted', onAbort)
        stream.on('data', onData)
        stream.on('end', onEnd)
        stream.on('error', onError)
        stream.on('close', onClose)
    })
}

getFeaturesOnAvenuesStream().then(console.log)
