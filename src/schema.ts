import { makeExecutableSchema } from "@graphql-tools/schema";
import DataLoader from "dataloader";
import { GraphQLError } from "graphql";

import type { Db } from "./db";

type BookRow = { id: number; title: string; author: string };
type MemberRow = { id: number; name: string };
type LoanRow = { id: number; book_id: number; member_id: number };

const typeDefs = /* GraphQL */ `
  type Book {
    id: ID!
    title: String!
    author: String!
    "Null while the book is available"
    loan: Loan
  }

  type Member {
    id: ID!
    name: String!
    loans: [Loan!]!
  }

  type Loan {
    id: ID!
    book: Book!
    member: Member!
  }

  type Query {
    books: [Book!]!
    members: [Member!]!
  }

  type Mutation {
    addBook(title: String!, author: String!): Book!
    addMember(name: String!): Member!
    lendBook(bookId: ID!, memberId: ID!): Loan!
    returnBook(bookId: ID!): Book!
  }
`;

function generateBadInputError(message: string) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

function requireValue(value: string, message: string) {
  const trimmed = value.trim();
  if (!trimmed) throw generateBadInputError(message);
  return trimmed;
}

export function createContext(db: Db) {
  return {
    db,
    bookById: new DataLoader(async (ids: readonly number[]) => {
      const { rows } = await db.query<BookRow>(
        "select * from books where id = any($1)",
        [ids],
      );
      return ids.map((id) => rows.find((row) => row.id === id) ?? null);
    }),
    memberById: new DataLoader(async (ids: readonly number[]) => {
      const { rows } = await db.query<MemberRow>(
        "select * from members where id = any($1)",
        [ids],
      );
      return ids.map((id) => rows.find((row) => row.id === id) ?? null);
    }),
    loanByBookId: new DataLoader(async (bookIds: readonly number[]) => {
      const { rows } = await db.query<LoanRow>(
        "select * from loans where book_id = any($1)",
        [bookIds],
      );
      return bookIds.map(
        (id) => rows.find((row) => row.book_id === id) ?? null,
      );
    }),
    loansByMemberId: new DataLoader(async (memberIds: readonly number[]) => {
      const { rows } = await db.query<LoanRow>(
        "select * from loans where member_id = any($1) order by id",
        [memberIds],
      );
      return memberIds.map((id) => rows.filter((row) => row.member_id === id));
    }),
  };
}
export type Context = ReturnType<typeof createContext>;

const resolvers = {
  Query: {
    books: async (_: unknown, __: unknown, { db }: Context) =>
      (await db.query<BookRow>("select * from books order by id")).rows,
    members: async (_: unknown, __: unknown, { db }: Context) =>
      (await db.query<MemberRow>("select * from members order by id")).rows,
  },

  Mutation: {
    addBook: async (
      _: unknown,
      args: { title: string; author: string },
      { db }: Context,
    ) => {
      const title = requireValue(args.title, "Title is required");
      const author = requireValue(args.author, "Author is required");
      const { rows } = await db.query<BookRow>(
        "insert into books (title, author) values ($1, $2) returning *",
        [title, author],
      );
      return rows[0];
    },
    addMember: async (_: unknown, args: { name: string }, { db }: Context) => {
      const name = requireValue(args.name, "Name is required");
      const { rows } = await db.query<MemberRow>(
        "insert into members (name) values ($1) returning *",
        [name],
      );
      return rows[0];
    },
    lendBook: async (
      _: unknown,
      args: { bookId: string; memberId: string },
      { db }: Context,
    ) => {
      try {
        const { rows } = await db.query<LoanRow>(
          "insert into loans (book_id, member_id) values ($1, $2) returning *",
          [args.bookId, args.memberId],
        );
        return rows[0];
      } catch (error) {
        const constraint = (error as { constraint?: string }).constraint;
        if (constraint === "loans_book_id_key")
          throw generateBadInputError("Book is already on loan");
        if (constraint === "loans_book_id_fkey")
          throw generateBadInputError(`No book has ID ${args.bookId}`);
        if (constraint === "loans_member_id_fkey")
          throw generateBadInputError(`No member has ID ${args.memberId}`);
        throw error;
      }
    },
    returnBook: async (
      _: unknown,
      args: { bookId: string },
      { db }: Context,
    ) => {
      const { rows } = await db.query<BookRow>(
        `with returned as (delete from loans where book_id = $1 returning book_id)
         select books.* from books join returned on books.id = returned.book_id`,
        [args.bookId],
      );
      if (rows.length === 0) throw generateBadInputError("Book is not on loan");
      return rows[0];
    },
  },

  Book: {
    loan: (book: BookRow, _: unknown, context: Context) =>
      context.loanByBookId.load(book.id),
  },
  Member: {
    loans: (member: MemberRow, _: unknown, context: Context) =>
      context.loansByMemberId.load(member.id),
  },
  Loan: {
    book: (loan: LoanRow, _: unknown, context: Context) =>
      context.bookById.load(loan.book_id),
    member: (loan: LoanRow, _: unknown, context: Context) =>
      context.memberById.load(loan.member_id),
  },
};

export const schema = makeExecutableSchema({ typeDefs, resolvers });
