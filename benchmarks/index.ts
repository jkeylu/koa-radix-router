import * as Benchmark from 'benchmark';
import * as assert from 'assert';
import { Router as RadixRouter } from '../';
import { githubApiList } from './helper';
const KoaRouter = require('koa-router');

const radixRouter = new RadixRouter();
const koaRouter = new KoaRouter();

githubApiList.forEach(api => {
    var method = api.method.toLowerCase();
    (<any>radixRouter)[method](api.pathExpression, api.handler);
    koaRouter[method](api.pathExpression, api.handler);
});

const radixRoutes = radixRouter.routes();
const koaRoutes = koaRouter.routes();

const suite = new Benchmark.Suite();

suite
    .add('koa-radix-router', function (deferred: any) {
        var count = 0;
        var addCount = function () { count++; };
        var results = [];
        var i = 0;
        var len = githubApiList.length;

        for (; i < len; i++) {
            var ctx = {
                method: githubApiList[i].method,
                addCount,
                path: githubApiList[i].path
            }
            results.push(radixRoutes(<any>ctx, null));
        }

        Promise.all(results).then(function () {
            assert.equal(count, len);
            deferred.resolve();
        });
    }, { defer: true })
    .add('koa-router', function (deferred: any) {
        var count = 0;
        var addCount = function () { count++; };
        var results = [];
        var i = 0;
        var len = githubApiList.length;

        for (; i < len; i++) {
            var ctx = {
                method: githubApiList[i].method,
                addCount,
                path: githubApiList[i].path
            }
            results.push(koaRoutes(<any>ctx, null));
        }

        Promise.all(results).then(function () {
            assert.equal(count, len);
            deferred.resolve();
        });
    }, { defer: true })
    // add listeners
    .on('cycle', function (event: Benchmark.Event) {
        console.log(String(event.target))
    })
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').map((it: any) => it.name));
    })
    // run async
    .run({
        // async: true
    });
