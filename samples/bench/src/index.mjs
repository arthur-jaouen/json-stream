import { open } from 'node:fs/promises'
import { parser } from '@ja-ja/json-stream'
import { performance } from 'perf_hooks'

import { avg, sum, median } from './math.mjs'

const BUFFER_SIZE = 4 * 1024
const BENCH_SIZE = 1

async function getLargeFile(bufferSize) {
    const buffers = []
    const handle = await open(new URL('../../data/large-file.json', import.meta.url), 'r')

    while (true) {
        const buffer = new Uint8Array(bufferSize)
        const { bytesRead } = await handle.read({ buffer })

        if (bytesRead === 0) {
            handle.close()
            break
        }

        buffers.push(buffer.subarray(0, bytesRead))
    }

    return buffers
}

async function getDistinctLots(buffers) {
    const lots = new Set()

    const { write, end } = parser({
        ignore: (path) =>
            !path.isKey(0, 'features') ||
            (path.length() > 2 && !path.isKey(2, 'properties')) ||
            (path.length() > 3 && !path.isKey(3, 'LOT_NUM')),

        drop: (path, value) => {
            if (
                path.length() === 4 &&
                path.isKey(0, 'features') &&
                path.isKey(2, 'properties') &&
                path.isKey(3, 'LOT_NUM')
            ) {
                lots.add(value)
            }

            return true
        },
    })

    for (let i = 0; i < buffers.length; i++) {
        write(buffers[i])
    }

    end()

    return lots
}

async function getFeaturesOnAvenues(buffers) {
    const { write, end } = parser({
        drop: (path, value) =>
            path.length() === 2 && path.isKey(0, 'features') && value.properties.ST_TYPE !== 'AVE',
    })

    for (let i = 0; i < buffers.length; i++) {
        write(buffers[i])
    }

    return end()
}

async function runFullParse(buffers) {
    const { write, end } = parser({})

    for (let i = 0; i < buffers.length; i++) {
        write(buffers[i])
    }

    return end()
}

function padNum(n, size) {
    return (
        (
            new Intl.NumberFormat('en', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(n > 1000 ? n / 1000 : n) + (n > 1000 ? ' s ' : ' ms')
        ).padStart(size, ' ') + '  '
    )
}

function padStr(str, size) {
    return str.substring(0, size).padEnd(size, ' ')
}

async function loop(fn, buffers) {
    for (let i = 0; i < Math.floor(BENCH_SIZE / 8); i++) {
        await fn(buffers)
    }

    for (let i = 0; i < BENCH_SIZE; i++) {
        performance.mark('start')
        fn(buffers)
        performance.measure(fn.name, 'start')
    }

    const durations = performance.getEntriesByName(fn.name).map((m) => m.duration)

    console.log(
        padStr(fn.name, 20),
        'avg:',
        padNum(avg(durations).toString(), 9),
        'med:',
        padNum(median(durations).toString(), 9),
        'total:',
        padNum(sum(durations).toString(), 9)
    )
}

async function bench() {
    const buffers = await getLargeFile(BUFFER_SIZE)

    await loop(getDistinctLots, buffers)
    await loop(getFeaturesOnAvenues, buffers)
    await loop(runFullParse, buffers)
}

bench()
