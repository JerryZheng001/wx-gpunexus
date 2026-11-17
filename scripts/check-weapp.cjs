// Check the native output: a successful webpack build alone does not ensure
// an isolated WeChat custom component receives its stylesheet.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const output = path.resolve(__dirname, '../dist')
const read = (file) => fs.readFileSync(path.join(output, file), 'utf8')
const app = JSON.parse(read('app.json'))
assert.equal(app.tabBar.custom, true, 'Expected the native custom TabBar')
for (const page of app.pages) {
  for (const extension of ['js', 'json', 'wxml']) {
    assert.ok(fs.existsSync(path.join(output, `${page}.${extension}`)), `Missing ${page}.${extension}`)
  }
}

const component = JSON.parse(read('custom-tab-bar/index.json'))
for (const page of ['goods', 'mall']) {
  // Taro extracts share flags into the Page registration, not the native JSON.
  const script = read(`pages/${page}/index.js`)
  assert.match(script, /enableShareAppMessage\s*[:=]\s*(?:true|!0)/, `${page} must enable friend sharing`)
  assert.match(script, /enableShareTimeline\s*[:=]\s*(?:true|!0)/, `${page} must enable timeline sharing`)
}
assert.equal(component.component, true)
const styles = read('custom-tab-bar/index.wxss')
assert.match(styles, /\.custom-tabbar\s*\{[^}]*display\s*:\s*flex\b/, 'TabBar must own its layout styles')
for (const dimension of ['width', 'height']) {
  assert.match(styles, new RegExp(`\\.nav-icon\\s*\\{[^}]*${dimension}\\s*:\\s*[1-9][\\d.]*rpx\\b`), `TabBar icons need a local ${dimension}`)
}
console.log(`WeChat build artifacts: ${app.pages.length} routes and custom TabBar styles passed.`)
