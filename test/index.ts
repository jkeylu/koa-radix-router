import * as Koa from 'koa';
import { Router } from '..';
import * as request from 'supertest';
import * as should from 'should';
import expect = require('expect.js');
const KoaRouter = require('koa-router');

describe('koa-radix-router', () => {
    it('support nested koa-router middleware', (done) => {
        var app = new Koa();
        var router = new Router();
        var koaRouter = new KoaRouter();

        koaRouter.get('/', (ctx: Koa.Context) => {
            ctx.body = { msg: 'hello' };
        });

        router.use('/hello', koaRouter.routes());

        request(app.use(router.routes()).callback())
            .get('/hello')
            .expect(200)
            .end((err, res) => {
                if (err) return done(err);
                expect(res.body).to.have.property('msg', 'hello');
                done();
            });
    });
});
