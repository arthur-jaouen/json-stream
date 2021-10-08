import render from './search.mjs'

const destroy = render()

if (import.meta.webpackHot) {
    import.meta.webpackHot.accept(['./search.mjs'], () => {
        destroy()
        render()
    })
}
