import { createHash } from 'crypto'
import djson = require('deterministic-json')
import muta = require('muta')

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
  useTx(txHandler: TransactionHandler)
  useBlock(blockHandler: BlockHandler)
  useInitializer(initializer: Initializer)
  compile?(): StateMachine
}

export interface BaseApplicationConfig {
  initialState: object
}

function LotionStateMachine(opts: BaseApplicationConfig): Application {
  let transactionHandlers = []
  let initializers = []
  let blockHandlers = []

  let appMethods = {
    use(middleware) {
      if (middleware instanceof Array) {
        middleware.forEach(appMethods.use)
      } else if (typeof middleware === 'function') {
        appMethods.useTx(middleware)
      } else if (middleware.type === 'tx') {
        appMethods.useTx(middleware.middleware)
      } else if (middleware.type === 'block') {
        appMethods.useBlock(middleware.middleware)
      } else if (middleware.type === 'initializer') {
        appMethods.useInitializer(middleware.middleware)
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
      let appState = opts.initialState
      let mempoolState = muta(appState)

      let nextState, nextInfo
      let chainInfo, mempoolInfo

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

      return {
        initialize(initialState, initialInfo) {
          chainInfo = initialInfo
          mempoolInfo = muta(chainInfo)
          Object.assign(appState, initialState)
          initializers.forEach(m => m(appState))
        },
        transition(action: Action) {
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
