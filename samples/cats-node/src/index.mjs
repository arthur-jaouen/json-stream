import { open } from 'node:fs/promises'
import { parse, entries } from '@ja-ja/json-stream'

async function getCats() {
    const handle = await open(new URL('./cats.json', import.meta.url))

    const buffer = new Uint8Array(1024)
    const reader = {
        async read() {
            const { bytesRead } = await handle.read({ buffer })

            if (bytesRead === 0) {
                return { done: true }
            }

            return { done: false, value: buffer.subarray(0, bytesRead) }
        },

        releaseLock() {
            handle.close()
        },
    }

    return parse(reader, { [entries]: { tags: { [skip]: () => true } } })
}

getCats().then(console.log)
