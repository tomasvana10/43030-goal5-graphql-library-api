# Goal 5 GraphQL Library API

Library system with GraphQL API and a SSR NextJS client

## Example API Usage

`POST /api/graphql`

```graphql
query {
  books {
    title
    loan {
      member { name }
    }
  }
}
```

```json
{
  "data": {
    "books": [
      { "title": "Dune", "loan": { "member": { "name": "Tomas Vana" } } },
      { "title": "Foundation", "loan": null }
    ]
  }
}
```
