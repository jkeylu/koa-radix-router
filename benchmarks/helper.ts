import * as fs from 'fs';
import * as Path from 'path';

export const githubReplacement
    = JSON.parse(fs.readFileSync(Path.resolve(__dirname, '../node_modules/path-handler-map/test/helper.ts'), { encoding: 'utf8' })
        .match(/const githubReplacement = ({[^}]*})/)[1]
        .replace(/\/\/.*/g, ''));

export const githubApiList
    = fs.readFileSync(Path.resolve(__dirname, '../node_modules/path-handler-map/test/fixtures/github-api.txt'), { encoding: 'utf8' })
        .split('\n')
        .filter(l => l && l[0] != '#')
        .map(l => l.split(' '))
        .map(l => ({
            method: l[0],
            pathExpression: l[1],
            path: l[1].replace(/(:[^\/]+)/g, (m, pname) => githubReplacement[pname]),
            handler: function (ctx: any) { ctx.addCount(); }
        }));
