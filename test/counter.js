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

  lsm.initialize({ count: -10, blockCount: 0 }, {})
  state = lsm.query()

  t.equal(state.count, 0)

  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
  lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
  lsm.transition({ type: 'transaction', data: { foo: 'bar' } })
  lsm.transition({ type: 'block', data: {} })
  lsm.commit()

  state = lsm.query()
  t.equal(state.count, 3)
  t.equal(state.blockCount, 1)

  lsm.transition({ type: 'begin-block', data: { time: 200 } })
  lsm.transition({ type: 'block', data: {} })
  hash = lsm.commit()
  t.equal(
    hash,
    '8353f3a8b718e3ac9661f9bee86e0b5cfe0115b797101c40cf002e974800e148'
  )

  state = lsm.query()
  t.equal(state.count, 3)
  t.equal(state.blockCount, 2)

  t.end()
})
