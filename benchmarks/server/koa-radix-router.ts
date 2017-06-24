import * as Koa from 'koa';
import { githubApiList } from '../helper';
import { Router } from '../..';

let app = new Koa();
let router = new Router();

githubApiList.forEach(api => {
    (<any>router)[api.method.toLowerCase()](api.pathExpression, function(ctx: Koa.Context) {
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
app.listen(3000, () => {
    console.log('Server [koa-radix-router] listening on 3000');
});
