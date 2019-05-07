'use strict'

const test = require('tape')
const LotionStateMachine = require('..').default

test('initialize state assigned to initialState', t => {
  let app = LotionStateMachine({ initialState: { x: 2, y: 2 } })
  app.useTx((state, tx, ctx) => {
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

test('initialState is optional', t => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, ctx) => {
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

test('tx must mutate state or validators', t => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, ctx) => {})

  let lsm = app.compile()
  lsm.initialize({}, {})
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  try {
    lsm.transition({ type: 'transaction', data: { value: 10 } })
    t.fail()
  } catch (err) {
    t.equals(
      err.message,
      'transaction must mutate state or validators to be valid'
    )
  }

  t.end()
})

test('tx not valid if it mutates non-validators property of ctx', t => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, ctx) => {
    ctx.y += 1
  })

  let lsm = app.compile()
  lsm.initialize({}, { y: 0 })
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  try {
    lsm.transition({ type: 'transaction', data: { value: 10 } })
    t.fail()
  } catch (err) {
    t.equals(
      err.message,
      'transaction must mutate state or validators to be valid'
    )
  }

  t.end()
})

test('tx valid if it mutates validators', t => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, ctx) => {
    ctx.validators['aOSx00CgYJ3/WGNgioJEs91irUHNvy+bV20hRTby7ak='] = 1
  })

  let lsm = app.compile()
  lsm.initialize({}, { y: 0 })
  lsm.transition({ type: 'begin-block', data: { time: 100 } })
  lsm.transition({ type: 'transaction', data: { value: 10 } })
  lsm.transition({ type: 'block' })
  lsm.commit()

  t.end()
})

test('error on unknown transition type', t => {
  let app = LotionStateMachine({})
  app.useTx((state, tx, ctx) => {
    ctx.y += 1
  })

  let lsm = app.compile()
  lsm.initialize({}, { y: 0 })
  try {
    lsm.transition({ type: 'foo' })
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Invalid transition: type=foo prev=initialize')
  }

  t.end()
})

test('check has side effects on mempool state', t => {
  let app = LotionStateMachine({})

  let expected
  app.useTx((state, tx, ctx) => {
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

test('check has side effects on mempool validators', t => {
  let app = LotionStateMachine({})

  let expected
  app.useTx((state, tx, ctx) => {
    t.equals(
      ctx.validators['aOSx00CgYJ3/WGNgioJEs91irUHNvy+bV20hRTby7ak='],
      expected
    )
    ctx.validators['aOSx00CgYJ3/WGNgioJEs91irUHNvy+bV20hRTby7ak='] += 1
  })

  let lsm = app.compile()
  lsm.initialize(
    {},
    { validators: { 'aOSx00CgYJ3/WGNgioJEs91irUHNvy+bV20hRTby7ak=': 0 } }
  )

  expected = 0
  lsm.check({})

  expected = 1
  lsm.check({})

  t.equals(
    lsm.context().validators['aOSx00CgYJ3/WGNgioJEs91irUHNvy+bV20hRTby7ak='],
    0
  )

  t.end()
})

test('check does not have side effects on committed state', t => {
  let state = {}
  let app = LotionStateMachine({})

  let expected
  app.useTx((state, tx, ctx) => {
    t.equals(state.x, expected)
    state.x += 1
  })

  let lsm = app.compile(state)
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

test('check does not have side effects on transition state', t => {
  let state = {}
  let app = LotionStateMachine({})

  let expected
  app.useTx((state, tx, ctx) => {
    t.equals(state.x, expected)
    state.x += 1
  })

  let lsm = app.compile(state)
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

test('check does not have side effects on query state', t => {
  let state = {}
  let app = LotionStateMachine({ initialState: state })

  let expected
  app.useTx((state, tx, ctx) => {
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

test('enforce transition order', t => {
  let app = LotionStateMachine({})

  app.useTx((state, tx, ctx) => {
    state.x += 1
  })

  let lsm = app.compile()

  try {
    lsm.transition({ type: 'begin-block', data: {} })
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Invalid transition: type=begin-block prev=none')
  }

  lsm.initialize({ x: 0 }, {})
  lsm.transition({ type: 'begin-block', data: {} })

  try {
    lsm.transition({ type: 'commit', data: {} })
    t.fail()
  } catch (err) {
    t.equals(err.message, 'Invalid transition: type=commit prev=begin-block')
  }

  lsm.transition({ type: 'block', data: {} })
  lsm.commit()

  t.end()
})
