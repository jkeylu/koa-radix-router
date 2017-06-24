import * as child_process from 'child_process';
import * as Path from 'path';

var s1 = child_process.fork(Path.join(__dirname, 'koa-radix-router'));
var s2 = child_process.fork(Path.join(__dirname, 'koa-router'));

s1.on('error', () => {
    s1.disconnect();
    s2.disconnect();
});

s2.on('error', () => {
    s1.disconnect();
    s2.disconnect();
});
