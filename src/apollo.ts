import { SchemaLink } from "@apollo/client/link/schema";
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs";

import { getDb } from "./db";
import { createContext, schema } from "./schema";

export const { PreloadQuery } = registerApolloClient(
  () =>
    new ApolloClient({
      cache: new InMemoryCache(),
      link: new SchemaLink({
        schema,
        context: async () => createContext(await getDb()),
      }),
    }),
);
