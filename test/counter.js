let test = require('tape')
let LotionApp = require('../dist/lotion-state-machine').default

test('counter app', t => {
  let app = LotionApp({ initialState: {} })

  app.use(function(state, tx) {
    state.count++
  })

  app.useBlock(function(state) {
    state.blockCount++
  })

  app.useInitializer(function(state) {
    state.count = 0
  })

  let lsm = app.compile()
  let state, hash

  lsm.initialize({ initialState: { count: -10, blockCount: 0 } })
  state = lsm.query()

  t.equal(state.count, 0)

  lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
  lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
  lsm.transition({ type: 'transaction', data: { foo: 'bar' } })

  state = lsm.query()
  t.equal(state.count, 3)

  lsm.transition({ type: 'block', data: {} })
  lsm.transition({ type: 'block', data: {} })

  state = lsm.query()
  t.equal(state.blockCount, 2)

  hash = lsm.commit()
  t.equal(
    hash,
    '71a80bf842c594d39f4d214a8d81b25fefeb190b7f538a59a15094929b37c83b'
  )

  t.end()
})
