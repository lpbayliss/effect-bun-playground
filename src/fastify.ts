import { Context, Effect, Layer } from "effect";
import { Elysia } from "elysia";

class ElysiaService extends Context.Tag("ElysiaService")<
  ElysiaService,
  Elysia
>() {}

const ServerLive = Layer.scopedDiscard(
  Effect.gen(function* (_) {
    const port = 3000;
    const app = yield* _(ElysiaService);
    yield* _(Effect.acquireRelease(
      Effect.sync(() => {
        app.listen(port)
      }),
      (server) => Effect.sync()
    ));
  })
);
