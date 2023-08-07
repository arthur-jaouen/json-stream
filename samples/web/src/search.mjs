import { parser } from '@ja-ja/json-stream'

function render() {
    const $form = document.getElementById('search-form')
    const $input = document.getElementById('search-input')
    const $results = document.getElementById('search-results')

    let controller = null

    $form.addEventListener('submit', onSubmit)

    doSearch()

    function removeChildren($node) {
        const range = document.createRange()

        range.selectNodeContents($node)
        range.deleteContents()
    }

    function showMessage(message) {
        requestAnimationFrame(() => {
            removeChildren($results)

            const $message = document.createElement('em')
            $message.textContent = message
            $results.appendChild($message)
        })
    }

    function showResults(results) {
        requestAnimationFrame(() => {
            removeChildren($results)

            const $list = document.createElement('ul')

            for (const feature of results) {
                const $item = document.createElement('li')
                $item.textContent = `${feature.properties.BLKLOT}: ${Object.entries(
                    feature.properties
                ).join(', ')}`
                $list.appendChild($item)
            }

            $results.appendChild($list)
        })
    }

    async function doSearch() {
        if (controller !== null) {
            controller.abort()
            controller = null
        }

        const value = $input.value.trim()

        if (value === '') {
            showMessage('Please enter a tag')
        } else {
            showMessage('Loading search results...')

            try {
                const search = value.split(/\s+/)
                const results = await getFeaturesFiltered(search)

                if (results.length === 0) {
                    showMessage('No results found')
                } else {
                    showResults(results)
                }
            } catch (e) {
                console.error(e)
                showMessage(`An error occurred: ${e.message}`)
            }
        }
    }

    async function getFeaturesFiltered(search) {
        controller = new AbortController()

        const response = await fetch('large-file.json', { signal: controller.signal })
        const reader = response.body.getReader()

        const { write, end } = parser({
            drop: (path, value) =>
                path.length() === 2 &&
                path.isKey(0, 'features') &&
                !Object.values(value.properties).some(
                    (prop) =>
                        prop !== null &&
                        search.some((s) => prop.toLowerCase().includes(s.toLowerCase()))
                ),
        })

        try {
            let buffer = await reader.read()

            while (!buffer.done && buffer.value !== undefined) {
                write(buffer.value)

                buffer = await reader.read()
            }

            return end().features
        } catch (e) {
            controller.abort()
            throw e
        } finally {
            reader.releaseLock()
        }
    }

    function onSubmit(event) {
        event.preventDefault()
        event.stopPropagation()

        doSearch()
    }

    async function onDestroy() {
        if (controller) {
            controller.abort()
            controller = null
        }

        $form.removeEventListener('submit', onSubmit)
    }

    return onDestroy
}

export default render
