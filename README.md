# QCloud 视频上传
* 依赖 sha1.js

> 只要正确实现了`window.hex_sha1`方法即可，上传时会将整部视频读入并用`window.hex_sha1`计算读入文件的`sha1`值，并作为字段传给视频服务器，最终上传完成时服务器会比对传过去的`sha1`值和所上传视频的`sha1`值，不符合时会返回错误信息:`-174 ERROR_CMD_COS_SHA_NOT_EQU 文件SHA不一致
`

* 支持断点续传
* 支持同时上传多部视频

## 最简单的例子

```
<!-- html -->
<input id="file" type="file" multiple>添加文件
<input id="anotherFile" type="file" multiple>继续添加
<ul id="uploadList">

</ul>
<div>
    <span id="uploadAllBtn">全部上传</span>
    <span id="pauseAllBtn">全部暂停</span>
<div>

/* js */

// 初始化实例
var uploader = new QCloudUpload({
    uploadUrl : ""  // 上传地址
});

/*
 * 支持<input type="file"> 的multiple属性，即可以一次选择多个文件
 * 跟jQuery类数组DOM的回调相同，订阅的事件会依次作用在所有add进来的视频中，通过this引用当前的上传对象以获取上传的状态、控制上传的暂停、继续、取消等操作
 */
// 订阅 [添加文件] 后的回调
uploader.on("addFile", function(file) {

    // 文件已存在于上传列表中则直接返回
    if (uploader.isExist(file.pieceHash)) {
        return false;
    }
    var uploadItem = $('<li class="upload-item">' +
                                '<div class="progress"></div>' +
                                '<span class="upBtn">上传</span>' +
                                '<span class="pauseBtn">暂停</span>' +
                                '<span class="cancleBtn">取消</span>' +
                        '</li>');

    // @file.pieceHash: 文件的前128B分片的hash，用来唯一标记一个文件，将其保存在一个上传list的节点上
    uploadItem.data("file_name", file.name)
              .data("piece_hash", file.pieceHash)
              .children(".progress").addClass(file.pieceHash);

    // 将一个上传文件添加到DOM
    $("#uploadList").append(uploadItem);
});

// 订阅回调： [全部上传完成]
uploader.on("allCompleted", function() {
    alert("全部上传成功");
});

// 订阅回调： [某个文件上传成功]
uploader.on("uploadEnd", function() {
    alert( this.name + "上传成功" );
});

// 订阅回调： [某个文件的上传进度]
uploader.on("uploadProgress", function() {
    $("#uploadList").find("." + this.file.pieceHash)   // 通过文件的pieceHash值将上传的文件和DOM节点一一对应
                    .html(this.state.progress + "%");

    // 中途可以暂停
    if ( {something happened} ) {
        this.pause();
    }
});

// [添加] 需要上传的文件
$("#file").on("change", function(e) {
    uploader.add(e.target.files);
});

// 从别的input [继续添加]
$("#anotherFile").on("change", function(e) {
    uploader.add(e.target.files);
});

// [全部上传]
$("#uploadAllBtn").on("click", function(e) {
    uploader.upload();
});

// [全部暂停]
$("#pauseAllBtn").on("click", function(e) {
    uploader.pause();
});

// [单个上传]
$("#uploadList").on("click", ".upBtn", function(e) {
    var thisHash = $(this).parent().data("piece_hash");
    uploader.upload( thisHash );
});

// [单个暂停]
$("#uploadList").on("click", ".pauseBtn", function(e) {
    var thisHash = $(this).parent().data("piece_hash");
    uploader.pause( thisHash );
});

// [取消] 某个上传
$("#uploadList").on("click", ".cancleBtn", function(e) {
    var thisHash = $(this).parent().data("piece_hash");
    uploader.cancle( thisHash );
});
```

## 全部入參(option)

### option.uploadUrl(必需)
* 视频上传的地址，即视频将被上传到QCloud服务器的哪个路径，参见[微视频api][api]
* 注：[微视频api][api]中所说的`sign`参数以`?sign={xxxxxxx...}`的方式拼接到`uploadUrl`中（即`get`的方式）

## 视频信息的设置(若需要)
* 文件可以配置的信息参见：[微视频api][api]
* 传递方法：在`<input type="file">`的`onchange`事件中将同名参数填入`file`对象中，例：

```
var uploader = new QCloudUpload();

// 这里以设置第一个文件的信息为例
$("#file").on("change", function(e) {
    var file = e.target.files[0];
    file.video_cover  = "http://xxxx/some.png";     // 设置视频封面
    file.video_title  = "母猪的产后护理.avi";         // 设置视频标题
    file.video_desc   = "母猪产后...blah blah blah"; // 设置视频描述
    file.magicContext = "http://xxxx";              // 设置用于透传回调用者的业务后台的字段
    uploader.add(e.target.files);
    uploader.upload(); // 上传
});
```

## 获取上传中文件的信息
* 通过实例的`on`方法订阅的回调函数中的`this`包含以下属性：

```
// this.state 引用 [上传状态]:
this.state :
{
    uploading    : false, // 上传中
    succeed      : false, // 上传完毕
    speed        : "",    // 上传速度（B/s）
    remainTime   : "",    // 剩余时间(s)
    progress     : 75,    // 已上传75%，[0-100]
    uploadedData : 521000 // 已上传的体积（B）
}

// this.file 引用 [视频文件]
this.file :
{
    name : "江北房源.mp4",
    size : 58943441, // B
    pieceHash : "2354d4fadf45sdfsdd",
    hash : "4a5sd4f6sdf4..." // 文件真正的hash值，第一片读取后才会填入，可用于调试
    ...
}
```
* 注意，被上传的文件中都包含`pieceHash`字段，此为一个视频的唯一标识（通过计算视频文件的前128B的数据生成的hash码），请通过它建立上传对象和DOM节点的联系，不要通过视频的文件名建立联系，因为文件名可能会有重复或不符合关键字定义等情况

* 通过调用实例的`on`方法订阅的回调函数中，`this`包含以下方法，可以在回调中`即时`控制上传流程

```
this.upload() // 上传
this.pause()  // 暂停上传
this.resume() // 继续上传
this.cancle() // 取消上传
```

## 实例方法
* 可以通过实例的相应方法名 + 视频的`pieceHash`值来实现对某个／全部视频上传流程的控制
* 某个视频上传流程的控制也可以在订阅的回调中通过调用`this.upload/pause/resume/cancle`来控制

### add: 将选中的文件添加到上传列表
* 参数：`<input type="file">`元素`onchange`后的`e.target.files`
* 必需是数组（`e.target.files`本来就是数组...）

```
// 选中文件后立即上传
var uploader = new QCloudUpload({
    uploadUrl ： “http://xxx”
});
$("#file").on("change", function(e) {
    uploader.add(e.target.files);
    uploader.upload();
});
```

### cancle: 移除`@pieceHash`文件
* 参数： `[pieceHash]`
* 如果被操作的文件正在上传，会停止上传并将其移除
* 不传參数时`移除所有上传`
* 移除后，文件及其上传进程都会被删掉，不可逆

```
var uploader = new QCloudUpload(ops);
$("#file").on("change", function(e) {
    uploader.add(e.target.files);
    uploader.upload();
});

// 3s后取消所有上传
setTimeout(function() {
    uploader.cancle();
}, 3000);
```

### isExist: 检查上传列表中是否存在`@pieceHash`文件
* 参数： `[pieceHash]`
* return `true` or `false`

### isAllUploaded: 监测是否所有文件`都已经上传完毕`
* 参数： `无`
* return `true` or `false`

### upload: 上传`@pieceHash`文件
* 参数： `[pieceHash]`
* 不传參数时`上传所有文件`

### pause: 暂停`@pieceHash`文件上传
* 参数： `[pieceHash]`
* 不传參数时`暂停所有上传`

### resume: 让被暂停的`@pieceHash`文件继续上传
* 参数： `[pieceHash]`
* 不传參数时`全部继续上传`
* 正在上传中或已上传完毕的文件不受控制

## 所有支持订阅的方法名
* 考虑到上传逻辑，每个方法名只能订阅`一次!`，重复订阅会抛出错误
* 通过执行实例的`on`方法可以绑定以下方法，绑定的方法会在相应的时机执行，并带入有用的`参数`
* 通过调用`off`方法将绑定的方法名解绑
* 通过`trigger`方法手动触发绑定过的方法，此方法一般为类内部使用，`不推荐手动调用`
* 订阅的回调函数中,`this`包含`state`属性、`file`属性，也可以调用`this`的相应方法控制上传流程

|方法名|参数|执行时机|return false时|
|----|---|---|---|
|addFile ( file )            |被添加的文件|文件`被添加到上传列表`时执行，回调中的`@file`中会首次被填进`pieceHash` 字段|不会上传此文件(被跳过)|
|fileReadError ( reader )    |`@reader`：reader对象的引用   |文件`读取失败`时执行，停止执行后续过程|--|
|fileReadStart ( reader )    |`@reader`：reader对象的引用   |文件`开始读取`时执行|不会继续读取整个文件（文件过大时有用），后续仍然可以对其执行upload|
|fileReadProgress ( reader ) |`@reader`：reader对象的引用   |文件`读取中持续`执行，不支持的浏览器不执行，`reader.lengthComputable`为`true`时可以拿到`reader.loaded`, `reader.total`|取消本次读取，后续仍然可以对其执行upload|
|fileReadEnd ( reader )      |`@reader`：reader对象的引用   |文件`读取完毕`时执行|`暂停`上传，后续仍然可以对其执行upload|
|uploadStart (  )            |请在回调中通过`this`引用属性、方法|第一片的数据成功返回后，文件`开始上传`时执行|`暂停`上传，后续仍然可以对其执行upload|
|uploadPause (  )            |请在回调中通过`this`引用属性、方法|文件`暂停上传`时执行|--|
|uploadResume (  )           |请在回调中通过`this`引用属性、方法|文件`恢复上传`时执行||
|uploadProgress (  )         |请在回调中通过`this`引用属性、方法|文件`上传过程中持续`执行，可用来动态显示上传进度、网速、剩余时间等|--|
|uploadEnd ( result )        |`@result`:上传成功后服务器返回的结果|文件`上传成功`时执行|--|
|uploadError (  )            |请在回调中通过`this`引用属性、方法|文件`上传过程中出错`时执行，可能发生在`uploadStart未成功时` `uploadProgress过程中`||
|allCompleted ( fileList )   |请在回调中通过`this`引用属性、方法|`所有文件上传成功`时执行||

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
* IE版本 IE10 PR2不支持readAsBinaryString() 和 readAsArrayBuffer()，所以不支持上传视频 ????
* safari版本
* opera
* 搜狗
* ...
#### 不兼容的处理方法 ?

#### 不兼容浏览器出现的问题 ?

[api]: https://www.qcloud.com/doc/product/314/3498#3.3-.E5.88.9B.E5.BB.BA.E8.A7.86.E9.A2.91.3A(.E5.88.86.E7.89.87.E4.B8.8A.E4.BC.A0.2C-.E7.AC.AC.E4.B8.80.E7.89.87) "微视频API文档"