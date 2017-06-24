#!/usr/bin/env bash

hostname="127.0.0.1"
t="-t10"
c="-c2k"
d="-d20s"

echo "= koa-radix-router ="
wrk $t $c $d --latency http://$hostname:3000/user

echo ""
echo "= koa-router ="
wrk $t $c $d --latency http://$hostname:3001/user

echo ""
echo "= koa-radix-router ="
wrk $t $c $d --latency http://$hostname:3000/repos/jkeylu/koa-radix-router/pulls/1/reviews/1/comments

echo ""
echo "= koa-router ="
wrk $t $c $d --latency http://$hostname:3001/repos/jkeylu/koa-radix-router/pulls/1/reviews/1/comments
