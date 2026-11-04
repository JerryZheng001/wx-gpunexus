const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve('dist-h5')
const types = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}
http
  .createServer((request, response) => {
    let requested
    try {
      requested = decodeURIComponent(request.url.split('?')[0])
    } catch {
      response.writeHead(400)
      response.end()
      return
    }
    const file = path.join(root, requested === '/' ? 'index.html' : requested)
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403)
      response.end()
      return
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404)
        response.end()
        return
      }
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
      fs.createReadStream(file).pipe(response)
    })
  })
  .listen(10086, '127.0.0.1', () => console.log('算力市 H5 预览：http://127.0.0.1:10086'))
