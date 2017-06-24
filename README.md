# koa-radix-router

> Router middleware for [koa](https://github.com/koajs/koa), like [koa-router](https://github.com/alexmingoia/koa-router) but more faster

## Installation

```sh
npm install koa-radix-router
```

## Usage

```
import * as Koa from 'koa';
import { Route } from 'koa-radix-router';

const app = new Koa();
const router = new Router();

router.get('/hello', ctx => {
    ctx.body = 'world';
});

app
    .use(router.routes())
    .use(router.allowedMethods());
```

## License

MIT
