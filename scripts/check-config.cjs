// Validate the bundled Taro schema offline; the CLI defaults to a remote schema
// and writes to the user's home directory, which is unsuitable for CI sandboxes.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const Module = require('node:module')
const configPath = path.resolve('config/index.ts')
const compiled = ts.transpileModule(fs.readFileSync(configPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const loaded = new Module(configPath, module)
loaded.filename = configPath
loaded.paths = Module._nodeModulePaths(path.dirname(configPath))
loaded._compile(compiled, configPath)
const validate = require('@tarojs/plugin-doctor/js-binding').validateConfig
validate(JSON.stringify(loaded.exports.default), '', false)
  .then((result) => {
    for (const message of result.messages) console.log(message.content)
    if (!result.isValid) process.exitCode = 1
    else console.log('Taro bundled configuration schema: passed (offline).')
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
