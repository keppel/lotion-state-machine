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
  check?(action): Promise<boolean | CheckResponse> | boolean | CheckResponse
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
      let chainInfo

      let nextState
      let nextInfo

      function applyTx(state, tx, info) {
        /**
         * state might be the raw app state, the mempool state, or a wrapper of the mempool state.
         */
        transactionHandlers.forEach(m => m(state, tx, info))
      }

      return {
        initialize(initialState, initialInfo) {
          chainInfo = initialInfo
          Object.assign(appState, initialState)
          initializers.forEach(m => m(appState))
        },
        transition(action: Action) {
          if (action.type === 'transaction') {
            let txState = muta(nextState)
            let txInfo = muta(nextInfo)
            applyTx(txState, action.data, txInfo)
            muta.commit(txState)
            muta.commit(txInfo)
          } else if (action.type === 'block') {
            /**
             * end block.
             * apply block handlers.
             * compute validator set updates.
             */
            blockHandlers.forEach(m => m(nextState, nextInfo))
            muta.commit(nextInfo)
          } else if (action.type === 'begin-block') {
            /**
             * begin block.
             * reset mempool state.
             * also set timestamp.
             */
            chainInfo.time = action.data.time
            nextInfo = muta(chainInfo)
            nextState = muta(appState)
          }
        },

        commit() {
          muta.commit(nextState)
          return createHash('sha256')
            .update(djson.stringify(appState))
            .digest('hex')
        },

        check(tx) {
          /**
           * wrap the mempool state and info for this one tx.
           * try applying this transaction.
           * if an error is thrown, transaction is invalid.
           * if neither wrapper is mutated, transaction is invalid.
           * if the transaction is invalid, rollback any mutations.
           */
          let mempoolTxState = muta(nextState)
          let mempoolTxInfo = muta(nextInfo)
          try {
            applyTx(mempoolTxState, tx, mempoolTxInfo)
            /**
             * tx was applied without error.
             * now make sure something was mutated.
             */
            if (wasMutated(mempoolTxState) || wasMutated(mempoolTxInfo)) {
              /**
               * valid tx.
               * commit mempooltx wrappers back to their sources.
               */
              muta.commit(mempoolTxState)
              muta.commit(mempoolTxInfo)
              return {}
            } else {
              throw new Error(
                'transaction must mutate state or validators to be valid'
              )
            }
          } catch (e) {
            /**
             * tx error.
             * invalid, don't mutate mempool state.
             */
            throw e
          }
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
