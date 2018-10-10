'use strict'

const test = require('tape')
const LotionStateMachine = require('..').default

test('create LSM', (t) => {
  let lsm = LotionStateMachine({})
  t.pass()
  t.end()
})

test('useTx', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.useTx((state, tx, context) => {
    t.equals(state.x, 0)
    t.equals(context.y, 5)
    t.equals(tx.value, 10)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 })
  lsm.transition({ type: 'begin-block', data: { y: 5 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('use with tx handler', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.use((state, tx, context) => {
    t.equals(state.x, 0)
    t.equals(context.y, 5)
    t.equals(tx.value, 10)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 })
  lsm.transition({ type: 'begin-block', data: { y: 5 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('useBlock', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.useBlock((state, context) => {
    t.equals(state.x, 0)
    t.equals(context.y, 5)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 })
  lsm.transition({ type: 'begin-block', data: { y: 5 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('useInitializer', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.useInitializer((state) => {
    t.equals(state.x, 0)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 }, { y: 5 })

  t.end()
})

test('use with array', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.use([
    {
      type: 'initializer',
      middleware (state) {
        t.equals(state.x, 0)
        state.x += 1
      }
    },
    {
      type: 'tx',
      middleware (state, tx, context) {
        t.equals(state.x, 1)
        t.equals(context.y, 5)
        t.equals(tx.value, 10)
        state.x += 1
      }
    },
    {
      type: 'block',
      middleware (state, context) {
        t.equals(state.x, 2)
        t.equals(context.y, 5)
        state.x += 1
      }
    }
  ])

  let lsm = app.compile()
  lsm.initialize({ x: 0 })
  lsm.transition({ type: 'begin-block', data: { y: 5 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('use with array with unknown type', (t) => {
  let app = LotionStateMachine({ initialState: {} })

  try {
    app.use([
      {
        type: 'foo',
        middleware (state) {}
      }
    ])
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Unknown middleware type')
  }

  t.end()
})
