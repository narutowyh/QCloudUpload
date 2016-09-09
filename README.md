# QCloud 视频上传
* 依赖 sha1.js

> 只要在页面上正确实现了`window.hex_sha1`方法即可。上传时组件会将整部视频读入并尝试用`window.hex_sha1`函数计算读入文件的`sha1`值。并在第一片时将其传给视频服务器，当所有分片上传完成之后，服务器会比对开始传过去的`sha1`值和服务器自己算出来的`sha1`值是否相同，若不相同会返回错误信息:`-174 ERROR_CMD_COS_SHA_NOT_EQU 文件SHA不一致
`

* 支持断点续传

## 简单的例子
* 更多例子请参考文件夹中的`demo-component`实例

```
// 初始化实例
var uploader = new QCloudUpload();

// 视频添加进来后立即上传
uploader.on("addFile", function(file) {
    this.upload();
});

// 通过 [uploader.add] 方法添加视频
$("#file").on("change", function(e) {
    var file = e.target.files[0];

    // 通过业务的接口去获取视频的上传地址[@uploadUrl]，（视频服务器要求每个视频都需要动态请求回一个有效的上传地址，参见[微视频api][api]）
    // [xxx.getUploadArgs]方法请在业务中自行实现
    xxx.getUploadArgs(function(uploadUrl) {
        file.uploadUrl = uploadUrl; // ⚠️此步必需：将获取回来的上传地址存入file.uploadUrl
        uploader.add(file); // 添加视频
    });
});


// 一个[xxx.getUploadArgs]的实现例子：
xxx.getUploadArgs = function(callback) {
    $.ajax({
        url : "http://vip.yaohuiwang.broker.anjuke.test/ajax/house/mediaUpload?action=upload",
        type : "get",
        dataType : "json",
        data : {},
        success : function(r) {
            if (r.data.sign) {
                callback && callback( "http://web.video.myqcloud.com/files/v1/10011010/" + r.data.bucketName + r.data.path + "?sign=" + encodeURIComponent(r.data.sign) );
            } else {
                window.console && console.error(">> 获取上传参数失败");
            }
        },
        error : function(err) {
            window.console && console.log(">> 获取上传参数失败");
        }
    });
}
```

## 视频信息的设置(若需要)
* 文件可以配置的信息参见：[微视频api][api]
* 传递方法：在`<input type="file">`的`onchange`事件中将同名参数填入`file`对象中，例：

```
var uploader = new QCloudUpload();
uploader.on("addFile", function(file) {
    this.upload(); // 添加进来文件之后立即上传
});

// 这里以设置第一个文件的信息为例
$("#file").on("change", function(e) {
    var file = e.target.files[0];
    file.video_cover  = "http://xxxx/some.png";     // 设置视频封面
    file.video_title  = "母猪的产后护理.avi";         // 设置视频标题
    file.video_desc   = "母猪产后...blah blah blah"; // 设置视频描述
    file.magicContext = "http://xxxx";              // 设置用于透传回调用者的业务后台的字段

    xxx.getUploadArgs(function(uploadUrl) {
        file.uploadUrl = uploadUrl; // ⚠️此步必需：将获取回来的上传地址存入file.uploadUrl
        uploader.add(file); // 添加视频
    });
});
```

## 获取文件信息
* 可以在`on`方法订阅的`回调函数中`获得以下信息：
* 注 ： `pieceHash`和`hash`两个字段是组件填进`file`对象中的，只有在回调中才存在，在`<input type="file">` 的`onchange`中是没有的!

```
// this.state [上传状态]:
{
    uploading    : false,       // 上传中
    succeed      : false,       // 上传完毕
    speed        : 256000000,   // 上传速度（B/s）
    remainTime   : 116,         // 剩余时间(s)
    progress     : 75,          // 已上传75%，[0-100]
    uploadedData : 521000       // 已上传的体积（B）
}

// this.file [视频文件]
{
    pieceHash : "2354d4fadf45sdfsdd",
    hash : "4a5sd4f6sdf4..." // 文件真正的hash值，第一片读取后才会填入，可用于调试
    name : "江北房源.mp4",
    size : 58943441, // B
    ...
}
```
* 注意，被上传的文件中都包含`pieceHash`字段，此为一个视频的唯一标识（通过计算视频文件的前128B的数据生成的hash码），请通过它建立上传对象和DOM节点的联系，不要通过视频的文件名建立联系，因为文件名可能会有重复或不符合关键字定义等情况

* 可以在`on`方法订阅的`回调函数中`调用以下方法，以`即时`控制上传的暂停、继续和取消等：

```
this.upload() // 上传
this.pause()  // 暂停上传
this.resume() // 继续上传
this.cancle() // 取消上传
```

## 实例属性
* fileList

> 为一个数组，数组元素为`add`进来的文件，文件包含`pieceHash`字段，无文件时为`[]`

* uploaderList

> 为一个对象，对象元素为`uploader对象的实例`，通过`pieceHash`值与`fileList`中的文件一一对应，为空时为`{}`.
> 可以通过此属性配合文件的`pieceHash`属性控制一个文件的暂停、继续和取消等

## 实例方法

### isSupportUpload
* 判断当前环境能否启用视频上传
* 返回值： `true` / `false`

### add: 将选中的文件添加到上传列表
* 参数必需是文件，例如`<input type="file">`元素`onchange`后的`e.target.files[0]`

```
var uploader = new QCloudUpload();

uploader.on("addFile", function(file) {

    // 文件小于300MB则立即上传
    if ( file.size <= 300 * 1024 * 1024 ) {
        this.upload();
    }
});

// 同时选择多部视频（<input type="file" multiple>）
$("#file").on("change", function(e) {
    var files = e.target.files;

    for (var i =0, len = files.length; i < len; ++i) {
        (function(index) {
            var file = files[index];

            xxx.getUploadArgs(function(uploadUrl) {
                file.uploadUrl = uploadUrl;
                uploader.add(file);
            });
        })(i);
    }

});
```

### cancle: 移除`@pieceHash`文件
* 参数： 用于唯一标识视频的`[pieceHash]`字段
* 如果被操作的文件正在上传，会停止上传并将其移除
* 不传參数时`移除所有上传`
* 移除后，文件及其上传进程都会被删掉，不可逆

```
var uploader = new QCloudUpload();
var file_piece_hash = "";

uploader.on("addFile", function(file) {
    file_piece_hash = file.pieceHash;
    this.upload(); // 将添加进来的文件立即上传
});

uploader.on("uploadCancle", function() {
    alert("已取消" + this.file.name + "文件的上传！");
});

$("#file").on("change", function(e) {
    var file = e.target.files[0];

    xxx.getUploadArgs(function(uploadUrl) {
        file.uploadUrl = uploadUrl;
        uploader.add(file);
    });
});

// 10s未上传完成则取消文件的上传
setTimeout(function() {
    if ( !uploader.uploaderList.file_piece_hash.state.succeed ) {
        uploader.cancle();
    }
}, 10000);
```

### isAllUploaded: 监测是否所有文件`都已经上传完毕`
* 参数： `无`
* return `true` or `false`

### upload: 上传`@pieceHash`文件
* 参数： 用于唯一标识视频的`[pieceHash]`字段
* 不传參数时`上传所有文件`
* 若文件未暂停状态则继续上传

### pause: 暂停`@pieceHash`文件上传
* 参数： 用于唯一标识视频的`[pieceHash]`字段
* 不传參数时`暂停所有上传`

### resume: 让被暂停的`@pieceHash`文件继续上传
* 参数： 用于唯一标识视频的`[pieceHash]`字段
* 不传參数时`全部继续上传`
* 正在上传中或已上传完毕的文件不受控制

## 所有支持订阅的方法名
* 考虑到上传逻辑，每个方法名只能订阅`一次!`，重复订阅会抛出错误
* 通过执行实例的`on`方法可以绑定以下回调函数，绑定的方法会在相应的时机执行，并带入有用的`参数`
* 通过调用`off`方法将绑定的回调解绑
* 通过`trigger`方法手动触发绑定过的回调，此方法一般为类内部使用，`不推荐手动调用`
* `fileReadStart`、`fileReadProgress`、`fileReadEnd`、`fileReadError`四个跟文件读取相关的事件会在实例的`upload`方法之后自动依次触发。因为考虑到读文件耗费较大性能，所以只有在`upload`方法被调用时，组件才会将文件读入，四个`fileReader`才会随即依次触发。

|方法名|回调参数|执行时机|return false时|
|----|---|---|---|
|addFile ( file )            |被添加的文件|文件`被添加到上传列表`时执行，<br>  回调中的`@file`中会首次被填进`pieceHash` 字段。<br> 选中后立即自动上传请在此回调中调用`this.upload()`|此文件将会被忽略|
|fileReadError ( reader )    |reader对象的引用   |文件`读取失败`时执行，停止执行后续过程|--|
|fileReadStart ( reader )    |reader对象的引用   |文件`开始读取`时执行|不会继续读取整个文件（文件过大时有用），<br> 后续仍然可以对其执行upload|--|
|fileReadProgress ( progress ) |progress对象的引用   |文件`读取中持续`执行，不支持的浏览器不执行.<br> `progress.lengthComputable`为`true`时<br> 可以拿到`progress.loaded`, `progress.total`|取消本次读取，后续仍然可以对其执行upload|--|
|fileReadEnd ( reader )      |reader对象的引用   |文件`读取完毕`时执行|此文件不会上传，<br> 后续仍然可以对其执行upload|--|
|uploadStart (  )            ||第一片的数据成功返回后，<br> 文件`开始上传`时执行|`暂停`上传，后续仍然可以对其执行upload|--|
|uploadPause (  )            ||文件`暂停上传`时执行|--|
|uploadResume (  )           ||文件`恢复上传`时执行|--|
|uploadCancle (  )           ||文件`被移除`时执行|取消移除操作|
|uploadProgress (  )         ||文件`上传过程中持续`执行，<br> 可用来动态显示上传进度、网速、剩余时间等|--|
|uploadEnd ( result )        |上传成功后服务器返回的结果|文件`上传成功`时执行|--|
|uploadError (  )            ||文件`上传过程中出错`时执行，<br> 可能发生在`uploadStart未成功时`<br>  `uploadProgress过程中`|--|
|allCompleted ()             ||`所有文件上传成功`时执行|--|

## 其它

### 文档
* [微视频api][api]
* [微视频服务器错误对照表](https://www.qcloud.com/doc/product/227/1833#4-proxy-.E9.94.99.E8.AF.AF.E7.A0.81)

### 实例
* demo-component > [upload]，一个带有尺寸、格式的校验功能只能上传一部视频的实例
* demo-component > [multi-upload]，一个带有尺寸、格式的校验功能可以同时上传多部视频的实例（待完善）

### 断点续传
* 断点续传的功能组件已封装好，用户再次上传曾上传过的视频时会自动从相应`进度`开始上传
* 原理：微云服务器会自动判断要上传的视频是不是可以断点续传的视频，并在第一次分片请求回的`offset`字段中自动将`offset`设置好，后续分片从这个`offset`处开始取即可
* 所以：刚进页面时`无法`获取上传过的视频和关闭页面时正在上传的视频及其进度，只有用户选择了某个视频并开始上传之后才能从服务器获取到这些信息
* 已上传过的视频会被`秒传`

### 注意点
* 文件过大时会返回错误： `-181 ERROR_CMD_COS_ERROR 存储后端错误`(尝试的文件大小为1.14GB，具体限制待研究)

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