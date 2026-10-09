import { InMemoryCache } from "@apollo/client";

import { appendToLibrary, forgetLoan, LIBRARY, type Loan } from "@/operations";

const LOAN: Loan = {
  __typename: "Loan",
  id: "1",
  book: { __typename: "Book", id: "1", title: "Foundation" },
  member: { __typename: "Member", id: "1", name: "Tomas" },
};

function cacheWithOneLoan() {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: LIBRARY,
    data: {
      books: [
        {
          __typename: "Book",
          id: "1",
          title: "Foundation",
          author: "Isaac Asimov",
          loan: LOAN,
        },
      ],
      members: [
        { __typename: "Member", id: "1", name: "Tomas", loans: [LOAN] },
      ],
    },
  });
  return cache;
}

test("Appends a new book to the cached list", () => {
  const cache = cacheWithOneLoan();
  appendToLibrary(cache, "books", {
    __typename: "Book",
    id: "2",
    title: "Dune",
    author: "Frank Herbert",
    loan: null,
  });

  expect(
    cache.readQuery({ query: LIBRARY })?.books.map((book) => book.title),
  ).toEqual(["Foundation", "Dune"]);
});

test("Removes a loan from the member's list", () => {
  const cache = cacheWithOneLoan();
  cache.modify({ id: cache.identify(LOAN.book), fields: { loan: () => null } });
  forgetLoan(cache, LOAN.id);

  const data = cache.readQuery({ query: LIBRARY });
  expect(data?.books[0].loan).toBeNull();
  expect(data?.members[0].loans).toEqual([]);
});
