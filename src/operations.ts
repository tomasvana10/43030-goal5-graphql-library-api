import {
  type ApolloCache,
  gql,
  type Reference,
  type TypedDocumentNode,
} from "@apollo/client";

export type Loan = {
  __typename: "Loan";
  id: string;
  book: { __typename: "Book"; id: string; title: string };
  member: { __typename: "Member"; id: string; name: string };
};
export type Book = {
  __typename: "Book";
  id: string;
  title: string;
  author: string;
  loan: Loan | null;
};
export type Member = {
  __typename: "Member";
  id: string;
  name: string;
  loans: Loan[];
};
export type LibraryData = { books: Book[]; members: Member[] };

export const LIBRARY: TypedDocumentNode<LibraryData> = gql`
  query Library {
    books {
      id
      title
      author
      loan {
        id
        book {
          id
          title
        }
        member {
          id
          name
        }
      }
    }
    members {
      id
      name
      loans {
        id
        book {
          id
          title
        }
        member {
          id
          name
        }
      }
    }
  }
`;

export const ADD_BOOK: TypedDocumentNode<
  { addBook: Book },
  { title: string; author: string }
> = gql`
  mutation AddBook($title: String!, $author: String!) {
    addBook(title: $title, author: $author) {
      id
      title
      author
      loan {
        id
      }
    }
  }
`;

export const ADD_MEMBER: TypedDocumentNode<
  { addMember: Member },
  { name: string }
> = gql`
  mutation AddMember($name: String!) {
    addMember(name: $name) {
      id
      name
      loans {
        id
      }
    }
  }
`;

export const LEND_BOOK: TypedDocumentNode<
  { lendBook: Loan },
  { bookId: string; memberId: string }
> = gql`
  mutation LendBook($bookId: ID!, $memberId: ID!) {
    lendBook(bookId: $bookId, memberId: $memberId) {
      id
      book {
        id
        title
        loan {
          id
        }
      }
      member {
        id
        name
        loans {
          id
          book {
            id
            title
          }
          member {
            id
            name
          }
        }
      }
    }
  }
`;

export const RETURN_BOOK: TypedDocumentNode<
  { returnBook: { __typename: "Book"; id: string; loan: null } },
  { bookId: string }
> = gql`
  mutation ReturnBook($bookId: ID!) {
    returnBook(bookId: $bookId) {
      id
      loan {
        id
      }
    }
  }
`;

export function appendToLibrary(
  cache: ApolloCache,
  field: "books" | "members",
  item: Book | Member,
) {
  cache.modify({
    fields: {
      [field]: (refs: readonly Reference[], { toReference }) => {
        const ref = toReference(item, true);
        return ref ? [...refs, ref] : refs;
      },
    },
  });
}

export function forgetLoan(cache: ApolloCache, loanId: string) {
  cache.evict({ id: cache.identify({ __typename: "Loan", id: loanId }) });
  cache.gc();
}
