export function sum(arr) {
    let sum = 0

    for (const elem of arr) {
        sum += elem
    }

    return sum
}

export function avg(arr) {
    return sum(arr) / arr.length
}

export function median(arr) {
    function quickselect(arr, half) {
        if (arr.length == 1) {
            return arr[0]
        } else {
            const pivot = arr[0]
            const lows = []
            const highs = []

            let pivotCount = 0

            for (const elem of arr) {
                if (elem < pivot) {
                    lows.push(elem)
                } else if (elem > pivot) {
                    highs.push(elem)
                } else {
                    pivotCount++
                }
            }

            if (lows.length > half) {
                return quickselect(lows, half)
            } else if (lows.length + pivotCount > half) {
                return pivot
            } else {
                return quickselect(highs, half - lows.length - pivotCount)
            }
        }
    }

    const half = arr.length / 2

    if (arr.length % 2 == 1) {
        return quickselect(arr, half)
    } else {
        return 0.5 * (quickselect(arr, half - 1) + quickselect(arr, half))
    }
}
