(function($) {

    // Uploader为用于上传文件的类，供组件类[@VideoUploadClass]内部使用，一个Uploader实例对应一部视频上传
    var Uploader = function(file, ops) {
        this.ops = ops;

        // 上传需要的数据，全都从服务器获取
        this.offset = "";     // 每次获取
        this.session = "";    // 上传第一片时获得
        this.slice_size = ""; // 每次获取
        this.firstSliceUploaded = false; // 第一片已上传过

        // 被上传的文件
        this.file = file;

        // 上传的状态
        this.state = {
            uploading : false, // 上传中
            succeed   : false, // 上传完毕
            speed     : "",    // 上传速度（B/s）
            remainTime   : "", // 剩余时间(s)
            progress     : 0,  // 已上传进度，[0-100]
            uploadedData : 0   // 已上传的体积(B)
        }
    }

    // 读取文件的部分内容，兼容不同浏览器
    var blobSlice = function(blob, startByte, endByte) {
        if (blob.slice) {
            return blob.slice(startByte, endByte);
        } else if (blob.webkitSlice) {
            return blob.webkitSlice(startByte, endByte);
        } else if (blob.mozSlice) {
            return blob.mozSlice(startByte, endByte);
        } else {
            window.console && console.error(">> 当前浏览器不支持文件分片，请更换浏览器上传");
            return null;
        }
    }

    var newReader = function() {
        if (window.FileReader) {
            return new FileReader();
        } else {
            window.console && console.error(">> 浏览器不支持File API");
            return false;
        }
    }

    var newFormData = function() {
        if (window.FormData) {
            return new FormData();
        } else {
            window.console && console.error(">> 浏览器不支持FormData");
            return false;
        }
    }

    var getSha1 = function(str) {
        if (window.hex_sha1) {
            return hex_sha1(str);
        } else {
            window.console && console.error(">> 请引入window.hex_sha1方法");
            return false;
        }
    }

    // 填充formData
    Uploader.prototype.appendFormData = function(formData, data) {
        for ( i in data ) {
            formData.append(i, data[i]);
        }
    }

    // 获取第一片的数据，主要是hash
    Uploader.prototype.getFirstSliceData = function(callback) {
        var self = this;
        var reader = newReader();
        var file = self.file;
        if (file.hash) {
            callback && callback();
        }
        reader.onerror = function(e) {

            // 回调2 onfileReadError
            self.ops.onfileReadError(self, e.target);
        };
        reader.onprogress = function(e) {

            // 回调3 ： onfileReadProgress
            if ( self.ops.onfileReadProgress(self, e) === false ) {
                e.target.abort();
            }
        }
        reader.onload = function(e) {
            file.hash = getSha1(reader.result);

            // 回调4 ：
            if ( self.ops.onfileReadEnd(self, e.target) === false ) {
                return;
            }

            callback && callback();
        }

        // 回调1：开始读取文件
        if( self.ops.onfileReadStart(self, reader) === false ) {
            return;
        } else {
            reader.readAsBinaryString(file);
        }
    }

    // 上传第一片
    Uploader.prototype.uploadFirstSlice = function() {
        var self = this;
        var file = self.file;
        var formData = newFormData();

        // 回调5
        if ( self.ops.onuploadStart(self) === false ) {
            return;
        }
        window.console && console.log(">> 开始上传，文件大小：", file.size + "B");

        self.appendFormData(formData, {
            op : "upload_slice", // 第一片固定值*
            filesize : file.size, // 视频文件总大小*
            sha : file.hash // 文件的sha值,必须提供*
        });

        // 可选的参数
        if ( file.session ) { // 如果想要断点续传,则带上上一次的session id
            formData.append("session", file.session);
        }
        if ( file.video_cover ) { // 视频封面的URL
            formData.append("video_cover", file.video_cover);
        }
        if ( file.video_title ) { // 视频标题
            formData.append("video_title", file.video_title);
        }
        if ( file.video_desc ) { // 视频描述
            formData.append("video_desc", file.video_desc);
        }
        if ( file.magicContext ) { // 转码成功后,用于透传回调用者的业务后台
            formData.append("magicContext", file.magicContext);
        }
        $.ajax({
            type : 'post',
            url : file.uploadUrl,
            data : formData,
            dataType : "json",
            processData : false,
            contentType : false,
            success : function(r) {

                // 秒传成功
                if (r.data.access_url) {
                    self.uploadCompleted(r);
                    return;
                } else if (r.data.offset !== undefined && r.data.session) {
                    self.offset = r.data.offset;
                    self.session = r.data.session;
                    self.slice_size = r.data.slice_size;
                    self.state.uploading = true;

                    // 回调6
                    self.ops.onuploadProgress(self);
                    self.uploadNextSlices();
                } else { // 有错误

                    // 回调7 uploadError
                    self.ops.onuploadError(self);
                }
            },
            error : function(err) {
                window.console && console.error(">> 第一片信息上传失败，请刷新重试");

                // 回调7 uploadError
                self.ops.onuploadError(self);
            }
        });
    }

    // 上传后续分片
    Uploader.prototype.uploadNextSlices = function() {
        var self = this;

        // 暂停中
        if ( !self.state.uploading ) {
            return false;
        }
        var reader = newReader();
        var formData = newFormData();
        var file = self.file;
        var blob = blobSlice(file, self.offset, self.offset + self.slice_size);
        self.appendFormData(formData, {
            op : "upload_slice", // 固定值*
            filecontent : blob, // 视频文件内容
            session : self.session, // 唯一标识此视频文件传输过程的id, 由后台下发, 调用方透传
            // sha : hex_sha1(reader.result), // 本次文件分片的sha值,可以提供用于校验(官方暂时未启用)
            offset : self.offset // 本次分片位移
        });

        // 上传此片的时间点
        var ts_start = +new Date();
        $.ajax({
            type : 'post',
            url : file.uploadUrl,
            data : formData,
            dataType : "json",
            processData : false,
            contentType : false,
            success : function(r) {
                if (r.data.offset != undefined) { // 继续上传

                    self.state.uploadedData = r.data.offset;
                    self.state.progress = self.state.uploadedData / file.size * 100;
                    var ts_end = +new Date(); // 此片上传完成的时间点
                    var ts_used = (ts_end - ts_start) / 1000; // 上传此片所用的时间，（s）
                    self.state.speed = self.slice_size / ts_used; // 网速（B/s）
                    self.state.remainTime = (file.size - self.state.uploadedData) / self.state.speed; // 剩余时间（s）

                    self.offset = r.data.offset + self.slice_size;
                    self.ops.onuploadProgress(self);
                    self.uploadNextSlices();
                } else { // 全部分片上传完毕
                    self.uploadCompleted(r);
                }
            },
            error : function(err) {

                // 回调7 上传出错
                self.ops.onuploadError(self);
                window.console && console.error("upload remained slices error: ", err);
            }
        });
    }

    // 所有分片上传完毕 / 秒传成功
    Uploader.prototype.uploadCompleted = function(r) {

        // 回调8：传递进度（100%）
        this.state.uploadedData = this.file.size;
        this.state.progress = 100;
        this.state.remainTime = 0;
        this.state.speed = 0;
        this.state.succeed = true;
        this.state.uploading = false;
        this.ops.onuploadProgress(this);
        this.ops.onuploadEnd(this, r);  // 回调8 结束
        window.console && console.log(">> upload finished:", this.file.name);
    }

    // 以下为Uploader实例的api **********************************************

    // 将上传列表中的文件上传
    Uploader.prototype.upload = function() {
        var self = this;
        if (this.state.succeed || this.state.uploading) {
            return;
        } else if (this.firstSliceUploaded) { // 第一片已经上传过
            this.resume();
        } else {
            this.getFirstSliceData(function() {
                self.uploadFirstSlice();
            });
        }
    }

    // 暂停上传
    Uploader.prototype.pause = function() {
        if (this.state.uploading) {
            this.state.uploading = false;
            window.console && console.log(">> 已暂停: ", this.file.name);
        }

        // 回调9
        this.ops.onuploadPause(self);
    }

    // 继续上传
    Uploader.prototype.resume = function() {
        if (!this.state.uploading) {
            this.state.uploading = true;
            this.uploadNextSlices();
        }

        // 回调10
        this.ops.onuploadResume(this);
    }

    // 取消上传
    Uploader.prototype.cancle = function() {
        var gen = this.ops._gener;
        var files = gen.fileList;
        var _hash = this.file.pieceHash;
        if ( this.ops.onuploadCancle === false ) {
            return;
        }
        this.pause();
        delete gen.uploaderList[_hash];
        for (var i = 0, len = files.length; i < len; ++i) {
            if (files[i].pieceHash === _hash) {
                files.splice(i, 1);
            }
        }
    }

// =======================================================================================================================================

    window.QCloudUpload = function(op) {
        this.ops = op || {};
        this.ops.uploadUrl = this.ops.uploadUrl, // 上传服务器的host
        this.fileList = [];     // 正在上传的文件列表，每次选中文件后做push判断
        this.uploaderList = {}; // 上传时，@self.fileList中的每个文件都一一对应一个uploader对象{},元素为 ： fileName : uploaderObj
        this.eventList = {};    // 用于订阅模式的事件队列
    }

    // 调用实例的@add方法时，针对每个文件生成一个对应的上传对象，并保存在@uploaderList中
    QCloudUpload.prototype._initUploader = function(file) {
        var self = this;
        // 初始化一个新的Uploader并保存
        self.uploaderList[file.pieceHash] = new Uploader(file, {
            uploadUrl : self.ops.uploadUrl,
            _gener : self,
            onfileReadStart : function(uploader, reader) {
                return self.trigger("fileReadStart", [uploader, reader]);
            },
            onfileReadError  : function(uploader, reader) {
                return self.trigger("fileReadError", [uploader, reader]);
            },
            onfileReadProgress  : function(uploader, reader) {
                return self.trigger("fileReadProgress", [uploader, reader]);
            },
            onfileReadEnd : function(uploader, reader) {
                return self.trigger("fileReadEnd", [uploader, reader]);
            },
            onuploadStart : function(uploader) {
                return self.trigger("uploadStart", [uploader]);
            },
            onuploadProgress : function(uploader) {
                return self.trigger("uploadProgress", [uploader]);
            },
            onuploadError : function(uploader) {
                return self.trigger("uploadError", [uploader]);
            },
            onuploadEnd : function(uploader, r) {
                var result = self.trigger("uploadEnd", [uploader, r]);
                if ( self.isAllUploaded() ) {
                    self.trigger("allCompleted", [uploader]);
                }
                return result;
            },
            onuploadPause : function(uploader) {
                return self.trigger("uploadPause", [uploader]);
            },
            onuploadResume : function(uploader) {
                return self.trigger("uploadResume", [uploader]);
            },
            onuploadCancle : function(uploader) {
                return self.trigger("uploadCancle", [uploader]);
            }
        });
        var a = [];
        a.push(self.uploaderList[file.pieceHash]);
        a.push(file);
        if ( self.trigger("addFile", a) === false ) {
            self.cancle();
        }
    }

    // api ***************************************************

    //setUploadRul
    QCloudUpload.prototype.setUploadUrl = function(newUrl) {
        this.ops.uploadUrl = newUrl;
    }

    // 将选中的文件@files（onChange获取的e.target.files对象）添加到上传列表
    QCloudUpload.prototype.add = function(file) {
        var self = this;
        var _file = file.length === undefined ? file : file[0];
        var reader = newReader();
        reader.onload = function(e) {
            _file.pieceHash = getSha1(e.target.result);

            self.fileList.push(_file);

            // 初始化此视频的上传器
            self._initUploader(_file);
        }
        var blob = blobSlice(_file, 0, 128);
        reader.readAsDataURL( blob );
    }

    // 检查上传列表中是否存在名为@fileName的文件
    QCloudUpload.prototype.isExist = function(hash) {
        var fileList = this.fileList;
        for (var i = 0, len = fileList.length; i < len; ++i) {
            if (fileList[i].pieceHash === hash) {
                return true;
            }
        }
        return false;
    }

    // 监测是否所有文件都已经上传完毕
    QCloudUpload.prototype.isAllUploaded = function() {
        var name = "";
        for (name in this.uploaderList) {
            if (!this.uploaderList[name].state.succeed) {
                return false
            }
        }
        return true;
    }

    // 上传文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.upload = function(name) {
        if (!name) {
            this._uploadAll();
        } else if(this.uploaderList[name]) {
            this.uploaderList[name].upload();
        }
    }

    // 暂停文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.pause = function(name) {
        if (!name) {
            this._pauseAll();
        } else if(this.uploaderList[name]) {
            this.uploaderList[name].pause();
        }
    }

    // 继续文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.resume = function(name) {
        if (!name) {
            this._resumeAll();
        } else if(this.uploaderList[name]) {
            this.uploaderList[name].resume();
        }
    }

    // 取消文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.cancle = function(name) {
        if (!name) {
            this._cancleAll();
        } else if(this.uploaderList[name]) {
            this.uploaderList[name].cancle();
        }
    }

    // 全部上传
    QCloudUpload.prototype._uploadAll = function() {
        var name = 0;
        for (var name in this.uploaderList) {
            this.uploaderList[name].upload();
        }
    }

    // 全部暂停上传
    QCloudUpload.prototype._pauseAll = function() {
        for (name in this.uploaderList) {
            this.uploaderList[name].pause();
        }
    }

    // 全部继续上传
    QCloudUpload.prototype._resumeAll = function() {
        var name;
        for (name in this.uploaderList) {
            this.uploaderList[name].resume();
        }
    }

    // 全部取消上传
    QCloudUpload.prototype._cancleAll = function() {
        for (var name in this.uploaderList) {
            this.uploaderList[name].cancle();
        }
    }

    // 取消对文件的读取(在reader执行onload前执行abort)
    QCloudUpload.prototype.cancleFileRead = function(name) {
        var self = this;
        window.console && console.log("方法待定中");
    }

    // 添加订阅模式
    QCloudUpload.prototype.on = function(key, fn) {
        var eventList = this.eventList; // {}
        if (!eventList[key]) {
            eventList[key] = fn;
        } else {
            window.console && console.error(">> 不要重复订阅" + key + "方法！");
        }
    }

    QCloudUpload.prototype.off = function(key) {
        var eventList = this.eventList;
        if (!eventList[key]) {
            return;
        } else {
            eventList[key] = null;
        }
    }

    QCloudUpload.prototype.trigger = function(key, args) {
        var fn = this.eventList[key];
        var files = this.fileList;
        var _this = args.shift();
        if (!fn) {
            return;
        } else {
            return fn.apply(_this, args);
        }
    }

})(jQuery);