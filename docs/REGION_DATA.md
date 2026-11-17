# 省市字典来源

`src/constants/market-regions.json` 提取自 `@province-city-china/data@8.5.8`，与已提供 Web 项目的依赖版本相同。仅保留省份和地级市的 code/name，不包含区县和乡镇，不增加运行时依赖。

- 原项目：https://github.com/uiwjs/province-city-china
- 固定源文件：https://registry.npmjs.org/@province-city-china/data/-/data-8.5.8.tgz
- 源文件 SHA-256：`1d7e3aa6c75f1851e101bcc2f267d712cd55121adcc9093ecc348fb55a2726cc`
- 提取：省份为 city=0 且 area=0，城市为对应 province 下 city≠0 且 area=0。没有地级市条目的省级地区使用自身名称及编码，四个直辖市的省市编码相同，符合接口文档。
- 后端兼容过滤：原包的台湾省仅有 710000 省级记录，无城市数据；测试站拒绝以 710000 同时作为省市编码，因此暂不提供该选项，待后端同版本字典补齐。香港 810000、澳门 820000 的省市同码已通过后端字段校验。
- 产物：33 个省级地区、343 个城市选项，约 15 KB。所有提交编码均为六位字符串。

当前采用现有 Web 项目的固定数据版本，并非已取得后端 `common/marketregions/regions.json` 原文件。后端如更新或限制字典，需用其原文件核对并替换；已有记录中不在本地字典内的合法服务端编码在未更改时保留。

字段校验使用必定不合法的 `product.quantity=0`，使请求返回 400 而不创建草稿。广东/深圳、北京、上海、香港、澳门没有地区字段错误；广东搭配石家庄会同时返回 `supplier.location` 的父子关系错误。未使用该校验测试提交审核或修改现有记录。

原数据的 MIT 许可如下（来自原项目 v8.5.8 的 LICENSE）：

```text
MIT License

Copyright (c) 2019 wabg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
