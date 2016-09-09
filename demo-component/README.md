# 用于上传视频的组件
* 依赖 `QCloudUpload.js`
* 支持拖动
* 支持`multiple`

## 简单的例子


## 全部入參
|入參|是否必需|意义|
|---|---|---|
|fileIptSlter  |必需|`<input type="file">`的选择器|
|getUpArgsApi  |必需|用于获取上传地址的api接口地址|
|uploader      |必需|`QCloudUpload`实例|
|acceptedFormat|可选|可以上传的格式，默认avi,wmv,mpeg,mp4,mov,flv,3gp，传`*`不限制格式|
|appid         |可选|参见[微视频api][api] （默认值10011010）|
|minSize       |可选|最小文件大小（B）|
|maxSize       |可选|最大文件大小（B）|
|maxUpNumOnce  |可选|可以并发上传多少部()|
|maxUpNumAll   |可选|一共可以上传多少部|


## `getUpArgsApi`接口返回的数据格式（注意⚠️）
* `get`方法，无入參
* 出參`必需`按照下面的格式返回数据（注意`path`参数的`/`，前面有后面没有）：
* 参数意义参见[微视频api][api]

```
{
    "data" : {
        bucketName : "kaleido",
        path : "/kaleido/773829931787374592",
        sign : "kalsjdfjadsj..."
    },
    ...
}
```

## 其它

[api]: https://www.qcloud.com/doc/product/314/3498#3.3-.E5.88.9B.E5.BB.BA.E8.A7.86.E9.A2.91.3A(.E5.88.86.E7.89.87.E4.B8.8A.E4.BC.A0.2C-.E7.AC.AC.E4.B8.80.E7.89.87) "微视频API文档"