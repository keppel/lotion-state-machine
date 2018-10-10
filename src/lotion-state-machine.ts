import { createHash } from 'crypto'
import djson = require('deterministic-json')
import muta = require('muta')
import Router = require('lotion-router')

interface Action {
  type: string
  data: any
}

interface Middleware {
  type: string
  middleware: Function
}

interface CheckResponse {
  cost?: number
  log?: string
}

export interface StateMachine {
  initialize(initialState?, initialInfo?): void | Promise<void>
  transition(action)
  check?(action)
  query(query?)
  info?()
  commit(): string | Buffer | Promise<string | Buffer>
}

export type TransactionHandler = (state, tx, info?) => any
export type BlockHandler = (state, info?) => any
export type Initializer = (state, info?) => any

export interface Application {
  use(txHandler: TransactionHandler | Middleware | Middleware[])
  use(txHandler: string, route: TransactionHandler | Middleware | Middleware[])
  useTx(txHandler: TransactionHandler)
  useBlock(blockHandler: BlockHandler)
  useInitializer(initializer: Initializer)
  compile?(): StateMachine
}

export interface BaseApplicationConfig {
  initialState: object
}

// defines an FSM to ensure state machine transitions
// are called in the proper order
const validTransitions = {
  'none': new Set([ 'initialize' ]),
  'initialize': new Set([ 'begin-block' ]),
  'begin-block': new Set([ 'transaction', 'block' ]),
  'transaction': new Set([ 'transaction', 'block' ]),
  'block': new Set([ 'commit' ]),
  'commit': new Set([ 'begin-block' ])
}

function LotionStateMachine(opts: BaseApplicationConfig): Application {
  let transactionHandlers = []
  let initializers = []
  let blockHandlers = []
  let routes

  let appMethods = {
    use(middleware, route?) {
      if (typeof middleware === 'string') {
        if (routes == null) {
          routes = {}
        }

        let routeName = middleware
        if (routeName in routes) {
          throw Error(`Route "${routeName}" already exists`)
        }
        if (route == null) {
          throw Error('Expected middleware for route')
        }
        routes[routeName] = route
      } else if (middleware instanceof Array) {
        middleware.forEach(appMethods.use)
      } else if (typeof middleware === 'function') {
        appMethods.useTx(middleware)
      } else if (middleware.type === 'tx') {
        appMethods.useTx(middleware.middleware)
      } else if (middleware.type === 'block') {
        appMethods.useBlock(middleware.middleware)
      } else if (middleware.type === 'initializer') {
        appMethods.useInitializer(middleware.middleware)
      } else {
        throw Error('Unknown middleware type')
      }
      return appMethods
    },
    useBlock(blockHandler) {
      blockHandlers.push(blockHandler)
    },
    useTx(txHandler) {
      transactionHandlers.push(txHandler)
    },
    useInitializer(initializer) {
      initializers.push(initializer)
    },
    compile(): StateMachine {
      if (routes != null) {
        let router = Router(routes)
        appMethods.use(router)
      }

      let appState = opts.initialState || {}
      let mempoolState = muta(appState)

      let nextState, nextInfo
      let chainInfo, mempoolInfo

      let prevOp = 'none'

      function applyTx(state, tx, info) {
        /**
         * wrap the state and info for this one tx.
         * try applying this transaction.
         * if an error is thrown, transaction is invalid.
         * if neither wrapper is mutated, transaction is invalid.
         * if the transaction is invalid, rollback any mutations.
         */
        let txState = muta(state)
        let txInfo = muta(info)
        try {
          transactionHandlers.forEach(m => m(txState, tx, txInfo))
          /**
           * tx was applied without error.
           * now make sure something was mutated.
           */
          if (wasMutated(txState) || wasMutated(txInfo)) {
            /**
             * valid tx.
             * commit wrappers back to their sources.
             */
            muta.commit(txState)
            muta.commit(txInfo)
            return {}
          } else {
            throw new Error(
              'transaction must mutate state or validators to be valid'
            )
          }
        } catch (e) {
          /**
           * tx error.
           * invalid, don't mutate state.
           */
          throw e
        }
      }

      // check FSM to ensure consumer is transitioning us in the right order
      function checkTransition (type) {
        let valid = validTransitions[prevOp].has(type)
        if (!valid) {
          throw Error(`Invalid transition: type=${type} prev=${prevOp}`)
        }
        prevOp = type
      }

      return {
        initialize(initialState, initialInfo) {
          checkTransition('initialize')
          chainInfo = initialInfo
          mempoolInfo = muta(chainInfo)
          Object.assign(appState, initialState)
          initializers.forEach(m => m(appState))
        },
        transition(action: Action) {
          checkTransition(action.type)

          if (action.type === 'transaction') {
            applyTx(nextState, action.data, nextInfo)
          } else if (action.type === 'block') {
            /**
             * end block.
             * apply block handlers.
             * compute validator set updates.
             */
            blockHandlers.forEach(m => m(nextState, nextInfo))
          } else if (action.type === 'begin-block') {
            /**
             * begin block.
             * reset mempool state.
             * also set timestamp.
             */
            chainInfo.time = action.data.time
            nextState = muta(appState)
            nextInfo = muta(chainInfo)
          }
        },

        commit() {
          checkTransition('commit')

          /**
           * reset mempool state/info on commit
           */
          muta.commit(nextState)
          muta.commit(nextInfo)

          mempoolState = muta(appState)
          mempoolInfo = muta(chainInfo)

          return createHash('sha256')
            .update(djson.stringify(appState))
            .digest('hex')
        },

        check(tx) {
          applyTx(mempoolState, tx, mempoolInfo)
        },

        query(path) {
          return appState
        },

        info() {
          return chainInfo
        }
      }
    }
  }

  return appMethods
}

function wasMutated(wrapper): boolean {
  let patch = muta.patch(wrapper)

  return (
    Object.getOwnPropertySymbols(patch).length > 0 ||
    Object.keys(patch).length > 0
  )
}

export default LotionStateMachine
