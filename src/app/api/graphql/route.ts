import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { type Context, createContext, schema } from "@/schema";

const handler = startServerAndCreateNextHandler<NextRequest, Context>(
  new ApolloServer<Context>({ schema }),
  { context: async () => createContext(await getDb()) },
);

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
