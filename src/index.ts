import { Context, Effect, pipe } from "effect";
import * as S from "@effect/schema/Schema";
import type { ParseError } from "@effect/schema/ParseResult";

export class PokemonClient extends Context.Tag("PokemonClient")<
  PokemonClient,
  {
    getById(
      id: number
    ): Effect.Effect<Pokemon, FetchError | JSONError | ParseError, never>;
  }
>() {}

class FetchError {
  readonly _tag = "FetchError";
}

class JSONError {
  readonly _tag = "JSONError";
}

class SameWeightError {
  readonly _tag = "SameWeightError";
  constructor(readonly weight: number) {}
}

const pokemonSchema = S.Struct({
  name: S.String,
  weight: S.Number,
});

type Pokemon = S.Schema.Type<typeof pokemonSchema>;

const parsePokemon = S.decodeUnknown(pokemonSchema);

const getRandomNumberArray = Effect.all(
  Array.from({ length: 10 }, () =>
    Effect.sync(() => Math.floor(Math.random() * 100) + 1)
  )
);

const formatPokemon = (pokemon: Pokemon) =>
  `${pokemon.name} weighs ${pokemon.weight} hectograms`;

const getPokemon = (id: number) =>
  pipe(
    PokemonClient,
    Effect.flatMap((client) => client.getById(id)),
    Effect.catchAll(() => Effect.succeed({ name: "default", weight: 0 }))
  );

const calculateHeaviestPokemon = (pokemon: Pokemon[]) =>
  Effect.reduce(pokemon, 0, (highest, pokemon) =>
    pokemon.weight === highest
      ? Effect.fail(new SameWeightError(pokemon.weight))
      : Effect.succeed(pokemon.weight > highest ? pokemon.weight : highest)
  );

const context = Context.empty().pipe(
  Context.add(PokemonClient, {
    getById: (id) =>
      pipe(
        Effect.tryPromise({
          try: () => fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
          catch: () => new FetchError(),
        }),
        Effect.flatMap((response) =>
          Effect.tryPromise({
            try: () => response.json(),
            catch: () => new JSONError(),
          })
        ),
        Effect.flatMap((x) => parsePokemon(x)),
        Effect.catchAll(() => Effect.succeed({ name: "default", weight: 0 }))
      ),
  })
);

const program = pipe(
  getRandomNumberArray,
  Effect.flatMap((arr) =>
    Effect.all(arr.map(getPokemon), { concurrency: "unbounded" })
  ),
  Effect.tap((pokemon) =>
    Effect.log("\n" + pokemon.map(formatPokemon).join("\n"))
  ),
  Effect.flatMap((pokemon) => calculateHeaviestPokemon(pokemon)),
  Effect.catchTag("SameWeightError", (error) => Effect.log()),
  Effect.flatMap((heaviest) =>
    Effect.log(`The heaviest pokemon weighs ${heaviest} hectograms`)
  )
);

const runnable = Effect.provide(program, context);

Effect.runPromise(runnable);
