# lotion-state-machine

```typescript
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
```
