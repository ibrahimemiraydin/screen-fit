import {createServer} from 'node:http';
createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Screen Fit test fixture</title>');}).listen(4178,'127.0.0.1');
