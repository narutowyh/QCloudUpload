# QCloud 视频上传组件
* 依赖 jQuery（计划去除）、sha1.js
只要正确实现了`window.hex_sha1`方法即可，上传时会将整部视频读入并用`window.hex_sha1`计算读入文件的`sha1`值，并作为字段传给视频服务器，最终上传完成时服务器会服务器会比对传过去的`sha`值和所上传视频的`sha`值，不符合时会返回错误信息:`-174 ERROR_CMD_COS_SHA_NOT_EQU 文件SHA不一致
`
* 支持断点续传（QCloud原生支持）
* 支持同时上传多部视频
是否允许多文件同时上传请在具体业务中设置，并传入相应的maxUpNumAll参数
* 同一个实例不可以上传两部`同名、同扩展名`的视频
* `?`：待定或待完成

## 最简单的例子

```
// 上传的参数（`*`为必填）
var option = {
    uploadUrl : "", // * 上传地址
    maxUpNumAll : 1, // 只能上传一部视频
}
var uploader = new QCloudUpload();
```

## 全部入參(option)

### option.sizeToSlice ?
* 超过多大的文件需要分片上传`byte（B）`
* 默认`一律分片`

### option.maxUpNumOnce ？
* `同时`可以上传多少个视频
* 默认`1`

### option.maxUpNumAll
* `一共`可以上传多少个视频
* 默认`1`

### option.minSize ?
* 可以上传文件的`最小`体积，`byte(B)`
* 默认：`无限制`

### option.maxSize
* 可以上传文件的`最大`体积，`byte(B)`
* 默认`300mb`

### option.uploadUrl(必需)
* 视频上传的地址
* 参见[微视频api][api]
* 注：[微视频api][api]中所说的`sign`参数以`?sign={xxxxxxx...}`的方式拼接到`uploadUrl`中（即`get`的方式）

### option.acceptedFormat
* 可以上传的文件的类型字符串,以`逗号`分隔，传`*`时不限制格式
* 默认值： `"avi,wmv,mpeg,mp4,mov,flv,3gp"`

## 视频信息的设置
* 文件可以配置的信息参见：[微视频api][api]
* 传递方法：在`<input type="file">`的`onchange`事件中将同名参数填入`file`对象中，例：

```
var uploader = new QCloudUpload();
$("#file").on("change", function(e) {
    e.target.files[0].video_cover  = "http://xxxx/some.png";     // 设置视频封面
    e.target.files[0].video_title  = "母猪的产后护理.avi";         // 设置视频标题
    e.target.files[0].video_desc   = "母猪产后...blah blah blah"; // 设置视频描述
    e.target.files[0].magicContext = "http://xxxx";              // 设置用于透传回调用者的业务后台的字段
    uploader.add(e.target.files);
    uploader.upload();
});
```

## 实例属性

### fileList: 正在上传的文件数组
* 无文件上传时为`[]`
* 可以通过其中的元素引用到正在上传的`file对象`
* 上传完毕的`file对象`中存在属性`uploadSucceed:true`

### uploaderList
* `@self.fileList`中的每个文件都一一对应一个uploader对象:{ fileName : uploaderObj }
* 无文件上传时为`{}`
* `@uploaderObj`中存储了文件的上传状态：

```
this.state = {
    uploading : false, // 上传中
    succeed   : false, // 上传完毕
    speed     : "",    // 上传速度（KB/s）
    remain    : ""     // 剩余时间
}
```

## 实例方法

### add: 将选中的文件添加到上传列表
* 参数：`<input type="file">`元素`onchange`后的`e.target.files`
* 必需是数组

```
// 选中文件后立即上传
var uploader = new QCloudUpload();
$("#file").on("change", function(e) {
    uploader.add(e.target.files);
    uploader.upload();
});
```

### cancle: 移除名为`@name`的文件的上传进程
* 参数： `[name]`
* 如果被操作的文件正在上传，会停止上传并将其移除
* 不传參数时`移除所有上传`

```
var uploader = new QCloudUpload();
$("#file").on("change", function(e) {
    uploader.add(e.target.files);
    uploader.upload();
});

// 3s后取消并移除上传的文件
setTimeout(function() {
    uploader.fileList.length && uploader.cancle();
}, 3000);
```

### checkExist: 检查上传列表中是否存在名为`@name`的文件
* 参数： `[name]`
* return `true` or `false`

### isAllUploaded: 监测是否所有文件`都已经上传完毕`
* 参数： `无`
* return `true` or `false`

### upload: 将队列中文件名为`@name`的文件上传
* 参数： `[name]`
* 不传參数时`上传所有文件`

### pause: 将队列中文件名为`@name`的文件暂停
* 参数： `[name]`
* 不传參数时`暂停所有上传`

### resume: 继续队列中文件名为`@name`的文件的上传进程
* 参数： `[name]`
* 不传參数时`全部继续上传`

## 支持的回调方法名
* 通过执行实例的`on`方法可以绑定以下方法，绑定的方法会在特定的时机执行，并带入有用的`参数`
* 通过调用`off`方法将绑定的方法解绑，注意被解绑的函数需传递`引用`
* 通过`once`方法让绑定的方法只执行一次
* 通过`trigger`方法手动触发绑定过的方法，此方法一般为类内部使用，`不推荐手动调用`

|方法名|参数|执行时机|
|----|---|---|
|readFileStart |()|单个文件`开始读取`时执行|
|readFileProgress |()|单个文件`读取中`重复时执行，不支持的浏览器不执行|
|readFileEnd   |()|单个文件`读取完毕`时执行|
|uploadStart   |()|单个文件`开始上传`时执行|
|progress      |()|单个文件`上传过程中重复执行`，可用来动态显示上传进度、网速、剩余时间等|
|uploaded      |()|单个文件`上传成功`时执行|
|allCompleted  |()|`所有文件上传成功`时执行|
|fileReadError |()|单个文件`读取失败`时执行|
|uploadError   |()|单个文件`上传过程中出错`时执行|
|formatError   |()|选择的文件中`有非法格式`的视频时执行|
|sizeError     |()|选择的文件中`有非法体积`的视频时执行|
|numError      |()|选择文件后`数量超出限制`时执行|
|repeatError   |()|选择文件后`有重复选择`时执行|

## 其它

### 文档
* [微视频api][api]

### 断点续传
* 断点续传的功能组件已封装好，用户再次上传曾上传过的视频时会自动从相应`进度`开始上传
* 原理：微云服务器会自动判断要上传的视频是不是可以断点续传的视频，并在第一次分片请求回的`offset`字段中自动将`offset`设置好，后续分片从这个`offset`处开始取即可
* 所以：刚进页面时`无法`获取上传过的视频和关闭页面时正在上传的视频及其进度，只有用户选择了某个视频并开始上传之后才能从服务器获取到这些信息
* 已上传过的视频会被`秒传`

### 兼容性
#### 兼容浏览器 ?
* chrome
* 360`极速模式`
* 火狐版本
* IE版本
* safari版本
* opera
* 搜狗
* ...
#### 不兼容的处理方法 ?

#### 不兼容浏览器出现的问题 ?

[api]: https://www.qcloud.com/doc/product/314/3498#3.3-.E5.88.9B.E5.BB.BA.E8.A7.86.E9.A2.91.3A(.E5.88.86.E7.89.87.E4.B8.8A.E4.BC.A0.2C-.E7.AC.AC.E4.B8.80.E7.89.87) "微视频API文档"