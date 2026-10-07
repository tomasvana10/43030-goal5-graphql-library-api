"use client";

import { CombinedGraphQLErrors } from "@apollo/client";
import { type QueryRef, useMutation, useReadQuery } from "@apollo/client/react";
import { SubmitEvent, useState } from "react";

import {
  ADD_BOOK,
  ADD_MEMBER,
  appendToLibrary,
  type Book,
  forgetLoan,
  LEND_BOOK,
  type LibraryData,
  type Member,
  RETURN_BOOK,
} from "./operations";

type Attempt = (action: () => Promise<unknown>) => void;

export function Library({ queryRef }: { queryRef: QueryRef<LibraryData> }) {
  const { data } = useReadQuery(queryRef);
  const [error, setError] = useState<string | null>(null);

  const attempt: Attempt = async (action) => {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        CombinedGraphQLErrors.is(failure) && failure.errors[0]
          ? failure.errors[0].message
          : "Cannot connect to the server",
      );
    }
  };

  return (
    <>
      <h1>Library</h1>

      <h2>Books</h2>
      {data.books.length === 0 ? (
        <p>No books</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.books.map((book) => (
              <BookInformationRow
                key={book.id}
                book={book}
                members={data.members}
                attempt={attempt}
              />
            ))}
          </tbody>
        </table>
      )}
      <AddBookForm attempt={attempt} />

      <h2>Members</h2>
      {data.members.length === 0 ? (
        <p>No members</p>
      ) : (
        <ul>
          {data.members.map((member) => (
            <li key={member.id}>
              {member.loans.length > 0
                ? `${member.name}: borrowing ${member.loans.map((loan) => loan.book.title).join(", ")}`
                : member.name}
            </li>
          ))}
        </ul>
      )}
      <AddMemberForm attempt={attempt} />

      {error && <p role="alert">{error}</p>}
    </>
  );
}

function BookInformationRow({
  book,
  members,
  attempt,
}: {
  book: Book;
  members: Member[];
  attempt: Attempt;
}) {
  const [memberId, setMemberId] = useState("");
  const [lendBook, { loading: lending }] = useMutation(LEND_BOOK);
  const [returnBook] = useMutation(RETURN_BOOK);
  const loan = book.loan;

  return (
    <tr>
      <td>{book.title}</td>
      <td>{book.author}</td>
      <td>{loan ? `On loan to ${loan.member.name}` : "Available"}</td>
      <td>
        {loan ? (
          <button
            type="button"
            aria-label={`Return ${book.title}`}
            onClick={() =>
              attempt(() =>
                returnBook({
                  variables: { bookId: book.id },
                  optimisticResponse: {
                    returnBook: { __typename: "Book", id: book.id, loan: null },
                  },
                  update: (cache, { data }) => {
                    if (data) forgetLoan(cache, loan.id);
                  },
                }),
              )
            }
          >
            Return
          </button>
        ) : (
          <>
            <select
              aria-label={`Borrower of ${book.title}`}
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              <option value="" disabled>
                Choose a member
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>{" "}
            <button
              type="button"
              aria-label={`Lend ${book.title}`}
              disabled={!memberId || lending}
              onClick={() =>
                attempt(async () => {
                  await lendBook({ variables: { bookId: book.id, memberId } });
                  setMemberId("");
                })
              }
            >
              {lending ? "Lending..." : "Lend"}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function AddBookForm({ attempt }: { attempt: Attempt }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [addBook, { loading }] = useMutation(ADD_BOOK);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    attempt(async () => {
      await addBook({
        variables: { title, author },
        update: (cache, { data }) => {
          if (data) appendToLibrary(cache, "books", data.addBook);
        },
      });
      setTitle("");
      setAuthor("");
    });
  }

  return (
    <form onSubmit={submit}>
      <label>
        Title{" "}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>{" "}
      <label>
        Author{" "}
        <input
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
      </label>{" "}
      <button
        type="submit"
        disabled={!title.trim() || !author.trim() || loading}
      >
        {loading ? "Adding book..." : "Add book"}
      </button>
    </form>
  );
}

function AddMemberForm({ attempt }: { attempt: Attempt }) {
  const [name, setName] = useState("");
  const [addMember, { loading }] = useMutation(ADD_MEMBER);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    attempt(async () => {
      await addMember({
        variables: { name },
        update: (cache, { data }) => {
          if (data) appendToLibrary(cache, "members", data.addMember);
        },
      });
      setName("");
    });
  }

  return (
    <form onSubmit={submit}>
      <label>
        Name{" "}
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>{" "}
      <button type="submit" disabled={!name.trim() || loading}>
        {loading ? "Adding member..." : "Add member"}
      </button>
    </form>
  );
}
