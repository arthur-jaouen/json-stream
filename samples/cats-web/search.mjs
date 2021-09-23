import { parse, entries, filter } from '@ja-ja/json-stream'

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

            for (const cat of results) {
                const $item = document.createElement('li')
                $item.textContent = `${cat.id}: ${cat.tags.join(', ')}`
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
            showMessage('Loading search reslts...')

            try {
                const tags = value.split(/\s+/)
                const results = await getCatsFiltered(tags)

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

    async function getCatsFiltered(tags) {
        controller = new AbortController()

        const response = await fetch('https://cataas.com/api/cats', { signal: controller.signal })
        const reader = response.body.getReader()

        return parse(reader, {
            [entries]: {
                [filter]: (cat) => tags.some((tag) => cat.tags.includes(tag)),
            },
        })
    }

    function onSubmit(event) {
        event.preventDefault()
        event.stopPropagation()

        doSearch()
    }

    async function onDestroy() {
        controller.abort()
        controller = null

        $form.removeEventListener('submit', onSubmit)
    }

    return onDestroy
}

export default render
