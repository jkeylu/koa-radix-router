import * as compose from 'koa-compose';
import { PathHandlerMap, FindResult } from 'path-handler-map';
import { Middleware, Context } from 'koa';
import * as HttpError from 'http-errors';
import { METHODS } from 'http';

declare module 'koa' {
    interface Context {
        routerPath?: string;
        foundHandler: boolean;
        params?: any;
        pnames?: string[];
        pvalues?: string[];
    }
}

export interface RouterOptions {
    prefix?: string;
    sensitive?: boolean;
    strict?: boolean;
    methods?: string[];
}

export interface AllowedMethodsOptions {
    throw?: boolean;
    notImplemented?: () => any;
    methodNotAllowed?: () => any;
}

const ROUTER = Symbol.for('koa-radix-router/router');
const MIDDLEWARE = Symbol.for('koa-radix-router/middleware')

export { ROUTER, MIDDLEWARE };

export class Router {
    private prefix: string;
    private sensitive: boolean;
    private strict: boolean;
    private koaRoutes: Middleware;
    private pathMap: PathHandlerMap;
    private middleware: { path: string; middleware: Middleware; }[];
    methods: string[];

    constructor(opts?: RouterOptions) {
        opts = opts || {};

        this.prefix = opts.prefix || '';
        this.prefix = this.prefix.replace(/\/$/, '');

        this.sensitive = !!opts.sensitive;
        if (!this.sensitive) {
            this.prefix = this.prefix.toLowerCase();
        }

        this.strict = !!opts.strict;

        this.methods = opts.methods || [
            'HEAD',
            'OPTIONS',
            'GET',
            'PUT',
            'PATCH',
            'POST',
            'DELETE'
        ];

        this.middleware = [];
        this.pathMap = new PathHandlerMap();
    }

    private matchMiddleware(search: string) {
        var middleware: Middleware[] = [],
            sl: number = search.length,
            m: { path: string; middleware: Middleware },
            p: string,
            pl: number;

        if (search[sl - 1] != '/') {
            search += '/';
        }

        for (m of this.middleware) {
            p = m.path;
            pl = p.length;

            if (p[pl - 1] != '/') {
                p += '/';
            }

            if (search.startsWith(p)) {
                if (this.strict) {
                    if (pl <= sl) {
                        middleware.push(m.middleware);
                    }
                } else {
                    middleware.push(m.middleware);
                }
            }
        }

        return middleware;
    }

    use(path: string | string[], ...middleware: Middleware[]): this;
    use(...middleware: Middleware[]): this;
    use(): this {
        var args = Array.from(arguments),
            path: string = '',
            middleware: Middleware[] = args;

        if (Array.isArray(args[0]) && typeof args[0][0] == 'string') {
            middleware = args.slice(1);
            (<string[]>args[0]).forEach(p => {
                this.use(p, ...middleware);
            });

            return this;
        }

        if (typeof args[0] == 'string') {
            path = args.shift();
        }

        path = this.prefix + path;
        if (!this.sensitive) {
            path = path.toLowerCase();
        }

        middleware.forEach(m => {
            if ((<any>m)[ROUTER]) { // koa-radix-router
                var router: Router = (<any>m)[ROUTER];
                var methods = Object.keys(router.pathMap.tree.handlerMap);
                var preMiddleware = this.matchMiddleware(path);
                this.pathMap.merge(router.pathMap, path, (handler: Middleware) => {
                    if (preMiddleware.length > 0) {
                        let items: Middleware | Middleware[] = handler;
                        if ((<Object>handler).hasOwnProperty(MIDDLEWARE)) {
                            items = (<any>handler)[MIDDLEWARE];
                        }
                        return compose(preMiddleware.concat(items));
                    }
                    return handler;
                });

                var parent = router.pathMap.tree.parent;
                if (!this.strict && parent) {
                    methods.forEach(method => {
                        parent!.handlerMap[method] = {
                            handler: router.pathMap.tree.handlerMap[method].handler,
                            pnames: router.pathMap.tree.handlerMap[method].pnames.slice()
                        };
                    });
                }

            } else if ((<any>m).router) { // koa-router
                var koaRouter: any;
                if (this.koaRoutes) {
                    koaRouter = (<any>this.koaRoutes).router;
                    koaRouter.use.apply(koaRouter, arguments);

                } else {
                    koaRouter = (<any>m).router;
                    koaRouter.prefix(path);
                    koaRouter.opts.prefix = this.prefix;
                    this.koaRoutes = m;
                }

            } else {
                this.middleware.push({ path, middleware: m });
            }
        });

        return this;
    }

    register(method: string, path: string, ...middleware: Middleware[]) {
        if (method == 'GET') {
            var node = this.pathMap.lookup(path);
            if (!node || Object.keys(node.handlerMap).indexOf('HEAD') < 0) {
                this.register('HEAD', path, ...middleware);
            }
        }

        if (!this.sensitive) {
            path = path.toLowerCase();
        }

        var preMiddleware: Middleware[] = this.matchMiddleware(path);

        if (preMiddleware.length > 0) {
            middleware = preMiddleware.concat(middleware);
        }

        var handler: Function;
        if (middleware.length > 1) {
            handler = compose(middleware);
            (<any>handler)[MIDDLEWARE] = middleware;
        } else {
            handler = middleware[0];
        }

        path = this.prefix + path;
        var nodeInfo = this.pathMap.add(path, method, handler);

        if (!this.strict) {
            if (path == '/') {
                if (nodeInfo.node.parent) {
                    nodeInfo.node.parent.handlerMap[method] = { handler, pnames: nodeInfo.pnames };
                }
            } else if (path[path.length - 1] == '/') {
                path = path.substring(0, path.length - 1);
                this.pathMap.add(path, method, handler);
            } else if (path.indexOf('*') < 0) {
                path += '/';
                this.pathMap.add(path, method, handler);
            }
        }

        return this;
    }

    head(path: string, ...middleware: Middleware[]) {
        return this.register('HEAD', path, ...middleware);
    }

    get(path: string, ...middleware: Middleware[]) {
        return this.register('GET', path, ...middleware);
    }

    post(path: string, ...middleware: Middleware[]) {
        return this.register('POST', path, ...middleware);
    }

    put(path: string, ...middleware: Middleware[]) {
        return this.register('PUT', path, ...middleware);
    }

    delete(path: string, ...middleware: Middleware[]) {
        return this.register('DELETE', path, ...middleware);
    }

    patch(path: string, ...middleware: Middleware[]) {
        return this.register('PATCH', path, ...middleware);
    }

    options(path: string, ...middleware: Middleware[]) {
        return this.register('OPTIONS', path, ...middleware);
    }

    routes(): Middleware {
        var router = this;

        var dispatch = function dispatch(ctx: Context, next: () => Promise<any>) {
            var path = ctx.routerPath || ctx.path,
                r: FindResult,
                i: number,
                len: number,
                params: any;

            if (!router.sensitive) {
                path = path.toLowerCase();
            }

            r = router.pathMap.find(ctx.method, path);

            ctx.foundHandler = false;
            if (r.found) {
                params = {};
                for (i = 0, len = r.pnames!.length; i < len; i++) {
                    params[r.pnames![i]] = r.pvalues[i];
                }
                ctx.foundHandler = true;
                ctx.params = params;
                ctx.pnames = r.pnames;
                ctx.pvalues = r.pvalues;
                try {
                    return r.handler!(ctx, next);
                } catch (e) {
                    return Promise.reject(e);
                }
            }

            if (router.koaRoutes) {
                return handleKoaRoutes(router.koaRoutes, ctx, next);
            }

            return next();
        };

        (<any>dispatch)[ROUTER] = this;

        return dispatch;
    }

    allowedMethods(options?: AllowedMethodsOptions) {
        options = options || {};
        var implemented = this.methods;
        var router = this;

        return function allowedMethods(ctx: Context, next: () => Promise<any>) {
            return next().then(function () {
                var allowed: string[] = [];

                if (!ctx.status || ctx.status === 404) {
                    var path = ctx.path;
                    if (!router.sensitive) {
                        path = path.toLowerCase();
                    }
                    var node = router.pathMap.lookupByRealPath(path);
                    if (node != null) {
                        allowed = Object.keys(node.handlerMap);
                    }

                    if (implemented.indexOf(ctx.method) < 0) {
                        if (options!.throw) {
                            var notImplementedThrowable;
                            if (typeof options!.notImplemented === 'function') {
                                notImplementedThrowable = options!.notImplemented!(); // set whatever the user returns from their function
                            } else {
                                notImplementedThrowable = new HttpError.NotImplemented();
                            }
                            throw notImplementedThrowable;
                        } else {
                            ctx.status = 501;
                            ctx.set('Allow', allowed);
                        }
                    } else if (allowed.length) {
                        if (ctx.method === 'OPTIONS') {
                            ctx.status = 200;
                            ctx.body = '';
                            ctx.set('Allow', allowed);
                        } else if (allowed.indexOf(ctx.method) < 0) {
                            if (options!.throw) {
                                var notAllowedThrowable;
                                if (typeof options!.methodNotAllowed === 'function') {
                                    notAllowedThrowable = options!.methodNotAllowed!(); // set whatever the user returns from their function
                                } else {
                                    notAllowedThrowable = new HttpError.MethodNotAllowed();
                                }
                                throw notAllowedThrowable;
                            } else {
                                ctx.status = 405;
                                ctx.set('Allow', allowed);
                            }
                        }
                    }
                }
            });
        };
    }

    all(path: string, ...middleware: Middleware[]) {
        METHODS.forEach(method => {
            this.register(method, path, ...middleware);
        });

        return this;
    }

    redirect(source: string, dest: string, code?: number) {
        return this.all(source, function (ctx) {
            ctx.redirect(dest);
            ctx.status = code || 301;
        });
    }

    static url(path: string, params: { [key: string]: string; }) {
        return path.replace(/(:[^\/]*|\*.*$)/g, (_str: string, p1: string, _offset: number, _s: string) => {
            var name = p1;
            if (name.length > 1) {
                name = name.substring(1);
            }

            if (p1[0] == ':' && name[name.length - 1] != '*') {
                return encodeURIComponent(params[name]);
            }

            if (name.length > 1) {
                name.substring(0, name.length - 1);
            }
            return encodeURI(params[name]).replace(/[?#]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        });
    }
}

METHODS.forEach(method => {
    var propertyName = method.toLowerCase();
    if (!(<Object>Router.prototype).hasOwnProperty(propertyName)) {
        (<any>Router.prototype)[propertyName] = function (this: Router, path: string, ...middleware: Middleware[]) {
            return this.register(method, path, ...middleware);
        }
    }
});

function setKoaRoutesCtxFoundHandler(ctx: Context) {
    var matched = (<any>ctx).matched,
        i: number,
        len: number;

    if (!ctx.foundHandler && matched && matched.length > 0) {
        for (i = 0, len = matched.length; i < len; i++) {
            if (matched[i].methods.indexOf(ctx.method) >= 0) {
                ctx.foundHandler = true;
                break;
            }
        }
    }
}

function handleKoaRoutes(routes: Middleware, ctx: Context, next: () => Promise<any>) {
    var onNext = function () { setKoaRoutesCtxFoundHandler(ctx); return next(); },
        onFulfilled = function (value: any) { if (!ctx.foundHandler) { setKoaRoutesCtxFoundHandler(ctx); } return value; },
        onRejected = function (reason: any) { if (!ctx.foundHandler) { setKoaRoutesCtxFoundHandler(ctx); } throw reason; };
    return routes(ctx, onNext).then(onFulfilled, onRejected);
}
