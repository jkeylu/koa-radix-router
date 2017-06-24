import * as Koa from 'koa';
import { githubApiList } from '../helper';
const Router = require('koa-router');

let app = new Koa();
let router = new Router();

githubApiList.forEach(api => {
    router[api.method.toLowerCase()](api.pathExpression, function(ctx: Koa.Context) {
        ctx.body = {
            code: 0,
            message: 'OK',
            data: {
                word: 'Hello'
            }
        };
    });
});

app.use(router.routes());
app.listen(3001, () => {
    console.log('Server [koa-radix-router] listening on 3001');
});
