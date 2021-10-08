import { open } from 'node:fs/promises'
import { parse, entries, skip, filter } from '@ja-ja/json-stream'
import { performance } from 'perf_hooks'

import { avg, sum, median } from './math.mjs'

const BUFFER_SIZE = 1024
const BENCH_SIZE = 16

const TYPES = {
    CreateEvent: 'CreateEvent',
    PushEvent: 'PushEvent',
    WatchEvent: 'WatchEvent',
    ReleaseEvent: 'ReleaseEvent',
    PullRequestEvent: 'PullRequestEvent',
    IssuesEvent: 'IssuesEvent',
    ForkEvent: 'ForkEvent',
    GollumEvent: 'GollumEvent',
    IssueCommentEvent: 'IssueCommentEvent',
    DeleteEvent: 'DeleteEvent',
    PullRequestReviewCommentEvent: 'PullRequestReviewCommentEvent',
    CommitCommentEvent: 'CommitCommentEvent',
    MemberEvent: 'MemberEvent',
    PublicEvent: 'PublicEvent',
}

function getReader(buffers, name) {
    let counter = 0

    return {
        async read() {
            if (counter === buffers.length) {
                return { done: true }
            }

            const res = { done: false, value: buffers[counter++] }

            return res
        },

        releaseLock() {},
    }
}

async function getLargeFile(bufferSize) {
    const buffers = []
    const handle = await open(new URL('./large-file.json', import.meta.url))

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

async function runFullParse(reader) {
    await parse(reader, {})
}

async function getDistinctTypes(reader) {
    const types = new Set()

    await parse(reader, {
        [entries]: {
            type: {
                [filter]: (type) => (types.add(type), false),
            },
            [entries]: { [skip]: () => true },
            [filter]: () => false,
        },
    })

    return types
}

async function getGollumEvents(reader) {
    return parse(reader, {
        [entries]: {
            [filter]: (item) => item.type === TYPES.GollumEvent,
        },
    })
}

async function loop(fn, buffers) {
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

    for (let i = 0; i < BENCH_SIZE / 8; i++) {
        await fn(getReader(buffers()))
    }

    for (let i = 0; i < BENCH_SIZE; i++) {
        performance.mark('start')
        await fn(getReader(buffers()))
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

    await loop(runFullParse, () => buffers)
    await loop(getDistinctTypes, () => buffers)
    await loop(getGollumEvents, () => buffers)
}

bench()
