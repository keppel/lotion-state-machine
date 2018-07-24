import { createHash } from 'crypto'

interface Action {
  type: string
  data: object
}

interface Middleware {
  type: string
  middleware: Function
}

interface CheckResponse {
  isValid: boolean
  cost?: number
}

interface StateMachine {
  initialize(initialState?): void | Promise<void>
  transition(action): void | Promise<void>
  check?(action): Promise<boolean | CheckResponse> | boolean | CheckResponse
  query(query?)
  info?(): object
  commit(): string | Buffer | Promise<string | Buffer>
}

type TransactionHandler = (state, tx, info?) => any
type BlockHandler = (state, info?) => any
type Initializer = (state, info?) => any

interface LotionApp {
  use(txHandler: TransactionHandler | Middleware | Middleware[])
  useTx(txHandler: TransactionHandler)
  useBlock(blockHandler: BlockHandler)
  useInitializer(initializer: Initializer)
  compile(): StateMachine
}

interface LotionAppConfig {
  initialState: object
}

function LotionStateMachine(opts: LotionAppConfig): LotionApp {
  let transactionHandlers = []
  let initializers = []
  let blockHandlers = []

  let state = opts.initialState

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
      return {
        initialize(initialState: object) {
          Object.assign(state, initialState)
          initializers.forEach(m => m(state))
        },
        transition(action: Action) {
          if (action.type === 'transaction') {
            transactionHandlers.forEach(m => m(state, action.data))
          } else if (action.type === 'block') {
            blockHandlers.forEach(m => m(state))
          }
        },
        commit() {
          return createHash('sha256')
            .update(JSON.stringify(state))
            .digest('hex')
        },

        query(path) {
          return state
        }
      }
    }
  }

  return appMethods
}

export default LotionStateMachine
