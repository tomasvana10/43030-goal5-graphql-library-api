import { ApolloServer } from "@apollo/server";

import { type Db, openDb } from "@/db";
import { type Context, createContext, schema } from "@/schema";

const server = new ApolloServer<Context>({ schema });
const statements: string[] = [];
let db: Db;

const LEND_MUTATION = `mutation ($bookId: ID!, $memberId: ID!) {
  lendBook(bookId: $bookId, memberId: $memberId) { book { title } member { name } }
}`;

const RETURN_MUTATION = `mutation ($bookId: ID!) { returnBook(bookId: $bookId) { title loan { id } } }`;

async function addBook(title: string) {
  const result = await execute(
    `mutation ($title: String!) { addBook(title: $title, author: "Isaac Asimov") { id } }`,
    { title },
  );
  return result.data?.addBook.id as string;
}

async function addMember(name: string) {
  const result = await execute(
    `mutation ($name: String!) { addMember(name: $name) { id } }`,
    {
      name,
    },
  );
  return result.data?.addMember.id as string;
}

beforeAll(async () => {
  const opened = await openDb({ url: process.env.DATABASE_URL });
  db = {
    query: <T>(text: string, params?: unknown[]) => {
      statements.push(text);
      return opened.query<T>(text, params);
    },
    close: () => opened.close(),
  };
});

beforeEach(async () => {
  await db.query("TRUNCATE loans, books, members RESTART IDENTITY");
  statements.length = 0;
});

afterAll(async () => {
  await server.stop();
  await db.close();
});

async function execute(query: string, variables?: Record<string, unknown>) {
  const response = await server.executeOperation(
    { query, variables },
    { contextValue: createContext(db) },
  );
  if (response.body.kind !== "single")
    throw new Error("Expected a single result");
  return response.body.singleResult as {
    data?: Record<string, any> | null;
    errors?: readonly {
      message: string;
      extensions?: Record<string, unknown>;
    }[];
  };
}

test("Lists books and members in the order they were added", async () => {
  await addBook("The Last Question");
  await addBook("Foundation");
  await addMember("Tomas");

  const result = await execute(
    `{ books { title author loan { id } } members { name loans { id } } }`,
  );
  expect(result.data).toEqual({
    books: [
      { title: "The Last Question", author: "Isaac Asimov", loan: null },
      { title: "Foundation", author: "Isaac Asimov", loan: null },
    ],
    members: [{ name: "Tomas", loans: [] }],
  });
});

test("Shows loaned books from both entities", async () => {
  const book = await addBook("The Last Question");
  const member = await addMember("Tomas");

  const lent = await execute(LEND_MUTATION, { bookId: book, memberId: member });
  expect(lent.data?.lendBook).toEqual({
    book: { title: "The Last Question" },
    member: { name: "Tomas" },
  });

  const result = await execute(
    `{ books { loan { member { name } } } members { loans { book { title } } } }`,
  );
  expect(result.data).toEqual({
    books: [{ loan: { member: { name: "Tomas" } } }],
    members: [{ loans: [{ book: { title: "The Last Question" } }] }],
  });
});

test("Returns a book and makes it available again", async () => {
  const book = await addBook("Foundation");
  await execute(LEND_MUTATION, {
    bookId: book,
    memberId: await addMember("Tomas"),
  });

  const result = await execute(RETURN_MUTATION, { bookId: book });
  expect(result.data?.returnBook).toEqual({ title: "Foundation", loan: null });
});

test("Refuses to lend a book that is already on loan", async () => {
  const book = await addBook("Foundation");
  await execute(LEND_MUTATION, {
    bookId: book,
    memberId: await addMember("Tomas"),
  });

  const result = await execute(LEND_MUTATION, {
    bookId: book,
    memberId: await addMember("Manju"),
  });
  expect(result.errors?.[0].message).toBe("Book is already on loan");
  expect(result.errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
});

test("Identifies the book or member that doesn't exist", async () => {
  const book = await addBook("Foundation");
  const member = await addMember("Amelia");

  expect(
    (await execute(LEND_MUTATION, { bookId: "99", memberId: member }))
      .errors?.[0].message,
  ).toBe("No book has ID 99");
  expect(
    (await execute(LEND_MUTATION, { bookId: book, memberId: "99" })).errors?.[0]
      .message,
  ).toBe("No member has ID 99");
});

test("Refuses to return a book that is not on loan", async () => {
  const result = await execute(RETURN_MUTATION, {
    bookId: await addBook("Foundation"),
  });
  expect(result.errors?.[0].message).toBe("Book is not on loan");
});

test("Refuses a blank title, author or name", async () => {
  const emptyTitle = await execute(
    `mutation { addBook(title: " ", author: "Isaac Asimov") { id } }`,
  );
  const emptyAuthor = await execute(
    `mutation { addBook(title: "Emma", author: "") { id } }`,
  );
  const emptyName = await execute(`mutation { addMember(name: " ") { id } }`);
  expect(emptyTitle.errors?.[0].message).toBe("Title is required");
  expect(emptyAuthor.errors?.[0].message).toBe("Author is required");
  expect(emptyName.errors?.[0].message).toBe("Name is required");
});

test("Resolves book borrowers within 3 SQL statements regardless of the amount of books", async () => {
  const members = [await addMember("Tomas"), await addMember("Manju")];
  for (let i = 0; i < 10; i++) {
    const book = await addBook(`Book ${i}`);
    if (i % 2 === 0)
      await execute(LEND_MUTATION, {
        bookId: book,
        memberId: members[i % 4 === 0 ? 0 : 1],
      });
  }

  statements.length = 0;
  const result = await execute(`{ books { title loan { member { name } } } }`);
  expect(result.data?.books).toHaveLength(10);
  expect(statements).toHaveLength(3);
});
