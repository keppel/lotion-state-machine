'use strict'

const test = require('tape')
const LotionStateMachine = require('..').default

test('tx type not required with no routes registered', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.use((state, tx, info) => state.value = tx.value)

  let lsm = app.compile()
  lsm.initialize({}, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('tx type required when routes are registered', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.use('foo', (state, tx, info) => state.value = tx.value)

  let lsm = app.compile()
  lsm.initialize({}, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  try {
    lsm.transition({ type: 'transaction', data: { value: 10 } })
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Must provide type')
  }

  t.end()
})

test('simple route', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.use('foo', (state, tx, info) => state.x = tx.value)

  let lsm = app.compile()
  lsm.initialize({}, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { type: 'foo', value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.equals(lsm.query().foo.x, 10)

  t.end()
})

test('route with global tx handler', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.use('foo', (state, tx, info) => {
    t.equals(state.x, 10)
  })
  app.use((state, tx, info) => {
    state.foo.x = tx.value
  })

  let lsm = app.compile()
  lsm.initialize({}, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { type: 'foo', value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.equals(lsm.query().foo.x, 10)

  t.end()
})

test('error registering existing route', (t) => {
  let app = LotionStateMachine({ initialState: {} })
  app.use('foo', (state, tx, info) => {})

  try {
    app.use('foo', (state, tx, info) => {})
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Route "foo" already exists')
  }

  t.end()
})

test('error registering route with no middleware', (t) => {
  let app = LotionStateMachine({ initialState: {} })

  try {
    app.use('foo')
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Expected middleware for route')
  }

  t.end()
})
