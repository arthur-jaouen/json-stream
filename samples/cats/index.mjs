import { open } from 'node:fs/promises'
import { parse, entries } from '@ja-ja/json-stream'

async function getCats() {
    const response = await open('./cats.json')

    const buffer = new Uint8Array(1024)
    const reader = {
        async read() {
            const { bytesRead } = await response.read({ buffer })

            if (bytesRead === 0) {
                await response.close()

                return { done: true }
            }

            return { done: false, value: buffer.subarray(0, bytesRead) }
        },

        releaseLock() {},
    }

    return await parse(reader, { cats: { [entries]: { tags: null } } })
}

getCats().then(console.log)
