import { parser } from '../src/json-stream'
import { runTest } from './utils/utils'

it('should fail when write after end', () => {
    const { write, end } = parser({})

    write(new TextEncoder().encode('{}'))
    end()

    expect(() => write(new TextEncoder().encode(' '))).toThrowError(new Error('Invalid state'))
})

it('should fail when end after end', () => {
    const { write, end } = parser({})

    write(new TextEncoder().encode('{}'))
    end()

    expect(() => end()).toThrowError(new Error('Invalid state'))
})

it('should fail when write after fail', () => {
    const { write } = parser({})

    try {
        write(Uint8Array.of(0))
    } catch {
        // Ignore error
    }

    expect(() => write(new TextEncoder().encode(' '))).toThrowError(new Error('Invalid state'))
})

it('should fail when end after fail', () => {
    const { write, end } = parser({})

    try {
        write(Uint8Array.of(0))
    } catch {
        // Ignore error
    }

    expect(() => end()).toThrowError(new Error('Invalid state'))
})

runTest('starts with', `{"ab":0,"bb":1}`, { ignore: (path) => path.startsWith(0, 'a') }, { bb: 1 })

runTest('ends with', `{"aa":0,"ab":1}`, { ignore: (path) => path.endsWith(0, 'a') }, { ab: 1 })
