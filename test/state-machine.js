'use strict'

const test = require('tape')
const LotionStateMachine = require('..').default

test('initialize state assigned to initialState', (t) => {
  let app = LotionStateMachine({ initialState: { x: 2, y: 2 } })
  app.useTx((state, tx, info) => {
    t.equals(state.x, 0)
    t.equals(state.y, 2)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 }, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('initialState is optional', (t) => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, info) => {
    t.equals(state.x, 0)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 }, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('tx must mutate state or info', (t) => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, info) => {})

  let lsm = app.compile()
  lsm.initialize({}, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  try {
    lsm.transition({ type: 'transaction', data: { value: 10 } })
    t.fail()
  } catch (err) {
    t.equals(err.message, 'transaction must mutate state or validators to be valid')
  }

  t.end()
})

test('tx valid if it mutates info', (t) => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, info) => {
    info.y += 1
  })

  let lsm = app.compile()
  lsm.initialize({}, { y: 0 })
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('error on unknown transition type', (t) => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, info) => {
    info.y += 1
  })

  let lsm = app.compile()
  lsm.initialize({}, { y: 0 })
  try {
    lsm.transition({ type: 'foo' })
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Unknown transition type "foo"')
  }

  t.end()
})

test('check has side effects on mempool state', (t) => {
  let app = LotionStateMachine({})

  let expected
  app.useTx((state, tx, info) => {
    t.equals(state.x, expected)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 }, {})

  expected = 0
  lsm.check({})

  expected = 1
  lsm.check({})

  t.end()
})

test('check has side effects on mempool info', (t) => {
  let app = LotionStateMachine({})

  let expected
  app.useTx((state, tx, info) => {
    t.equals(info.y, expected)
    info.y += 1
  })

  let lsm = app.compile()
  lsm.initialize({}, { y: 0 })

  expected = 0
  lsm.check({})

  expected = 1
  lsm.check({})

  t.equals(lsm.info().y, 0)

  t.end()
})

test('check does not have side effects on committed state', (t) => {
  let state = {}
  let app = LotionStateMachine({ initialState: state })

  let expected
  app.useTx((state, tx, info) => {
    t.equals(state.x, expected)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 }, {})

  expected = 0
  lsm.check({})
  expected = 1
  lsm.check({})

  lsm.transition({ type: 'begin-block', data: {} })
  lsm.transition({ type: 'block', data: {} })
  lsm.commit()

  t.equals(state.x, 0)

  t.end()
})

test('check does not have side effects on transition state', (t) => {
  let state = {}
  let app = LotionStateMachine({ initialState: state })

  let expected
  app.useTx((state, tx, info) => {
    t.equals(state.x, expected)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 }, {})

  expected = 0
  lsm.check({})
  expected = 1
  lsm.check({})

  lsm.transition({ type: 'begin-block', data: {} })

  expected = 0
  lsm.transition({ type: 'transaction', data: {} })

  lsm.transition({ type: 'block', data: {} })
  lsm.commit()

  t.equals(state.x, 1)

  t.end()
})

test('check does not have side effects on query state', (t) => {
  let state = {}
  let app = LotionStateMachine({ initialState: state })

  let expected
  app.useTx((state, tx, info) => {
    t.equals(state.x, expected)
    state.x += 1
  })

  let lsm = app.compile()
  lsm.initialize({ x: 0 }, {})

  expected = 0
  lsm.check({})
  t.equals(lsm.query().x, 0)

  lsm.transition({ type: 'begin-block', data: {} })
  lsm.transition({ type: 'block', data: {} })
  lsm.commit()

  expected = 0
  lsm.check({})
  t.equals(lsm.query().x, 0)

  t.end()
})
