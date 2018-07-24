import LotionApp from '../src/lotion-state-machine'

let app = LotionApp({ initialState: {} })

app.use(function(state, tx) {
  state.count++
})

app.useBlock(function(state) {
  state.blockCount++
})

let lsm = app.compile()

lsm.initialize({ count: 0, blockCount: 0 })

lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
lsm.transition({ type: 'block', data: {} })
let hash = lsm.commit()
let state = lsm.query()
console.log(hash)
console.log(state)
