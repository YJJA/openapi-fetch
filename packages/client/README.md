# openapi-fetch

## About <a name = "about"></a>

Generate TypeScript client with OpenAPI spec.

## Usage <a name = "usage"></a>

### Step 1

```bash
npm install @openapi-fetch/client
```

### Step 2

add <code>.openapi-fetch.json</code> file to project root dir.

```js
{
  "items": [
    {
      "name": "petstore3",
      "spec": "https://petstore3.swagger.io/api/v3/openapi.json"
    }
  ]
}
```

### Step 3

run

```bash
npx @openapi-fetch/cli
```

### Step 4

```js
import { petstore3 } from "@openapi-fetch/client";

petstore3.findPetsByStatus().then((res) => {
  console.log(res);
});
```
