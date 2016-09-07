(function($) {

    // Uploader为用于上传文件的类，供组件类[@VideoUploadClass]内部使用，一个Uploader实例对应一部视频上传
    var Uploader = function(file, ops) {

        // 上传需要的数据，全都从服务器获取
        this.offset = "";  // 每次获取
        this.session = ""; // 上传第一片时获得
        this.slice_size = ""; // 每次获取

        // 被上传的文件
        this.file = file;

        // 上传的状态
        this.state = {
            uploading : false, // 上传中
            succeed   : false, // 上传完毕
            speed     : "",    // 上传速度（KB/s）
            remain    : ""     // 剩余时间
        }
    }

    // 读取文件的部分内容，兼容不同浏览器
    Uploader.prototype.blobSlice = function(blob, startByte, endByte) {
        if (blob.slice) {
            return blob.slice(startByte, endByte);
        } else if (blob.webkitSlice) {
            return blob.webkitSlice(startByte, endByte);
        } else if (blob.mozSlice) {
            return blob.mozSlice(startByte, endByte);
        } else {
            window.console && console.log("当前浏览器不支持文件分片，请更换浏览器上传");
            return null;
        }
    }

    // 填充formData
    Uploader.prototype.appendFormData = function(formData, data) {
        for ( i in data ) {
            formData.append(data[i]);
        }
    }

    // 上传第一片
    Uploader.prototype.uploadFirstSlice = function(callback) {
        var self = this;
        var reader = new FileReader();
        var formData = new FormData();
        var file = self.file;
        reader.onerror = function() {

            // 回调 onfileReadError
            if ( !self.ops.onfileReadError(file, reader, self) ) {
                window.console && console.error("读取文件失败，请重试： ", reader.error);
            }
        };
        reader.onload = function(e) {
            if (!window.hex_sha1) {
                window.console && console.error("window.hex_sha1算法未找到");
            }
            self.appendFormData(formData, {
                op : "upload_slice", // 第一片固定值*
                filesize : file.size, // 视频文件总大小*
                sha : window.hex_sha1(reader.result) // 文件的sha值,必须提供*
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
                url : self.ops.uploadUrl,
                data : formData,
                dataType : "json",
                processData : false,
                contentType : false,
                success : function(r) {

                    // 妙传成功
                    if (r.data.access_url) {
                        self.uploadCompleted(r);
                        return;
                    } else if (r.data.offset && r.data.session) {

                        // 回调，开始上传 uploadStart
                        window.console && console.log("开始上传，文件大小：", file.size + "B");

                        self.offset = r.data.offset;
                        self.session = r.data.session;
                        self.slice_size = r.data.slice_size;
                        self.state.uploading = true;
                        self.uploadNextSlices();
                    } else { // 有错误

                        // 回调 uploadError
                        self.ops.onuploadError(file, err);
                    }
                },
                error : function(err) {
                    window.console && console.log("第一片信息上传失败，请刷新重试");

                    // 回调 uploadError
                    self.ops.onuploadError(file, err);
                }
            });

            // 回调：读取文件完毕
            self.ops.onreadFileEnd(self.file);
        };
        reader.readAsBinaryString( file );

        // 回调：开始读取文件
        self.ops.onreadFileStart(file);
    }

    // 上传后续分片
    Uploader.prototype.uploadNextSlices = function() {
        var self = this;

        // 暂停中
        if ( !self.state.uploading ) {
            window.console && console.log("已暂停:", self.file);
            return false;
        }
        var reader = new FileReader();
        var formData = new FormData();
        var file = self.file;
        var blob = self.blobSlice(file, self.offset, self.offset + self.slice_size);

        // if ( false && self.offset + self.slice_size >= file.size ) { // 最后一片
        //     window.console && console.log("last piece")
        //     blob = self.blobSlice(file, self.offset, file.size);
        // }

        reader.onerror = function() {
            window.console && console.log("next slices read file error");
        };
        reader.onload = function(e) {
            self.appendFormData(formData, {
                op : "upload_slice", // 固定值*
                filecontent : blob, // 视频文件内容
                session : self.session, // 唯一标识此视频文件传输过程的id, 由后台下发, 调用方透传
                // sha : hex_sha1(reader.result), // 本次文件分片的sha值,可以提供用于校验(官方暂时未启用)
                offset : self.offset // 本次分片位移
            });
            $.ajax({
                type : 'post',
                url : self.ops.uploadUrl,
                data : formData,
                dataType : "json",
                processData : false,
                contentType : false,
                success : function(r) {
                    if (r.data.offset != undefined) { // 继续上传

                        // 回调：传递进度
                        self.ops.onprogress(self.offset, self.file.size, self.file, self);

                        self.offset = r.data.offset + self.slice_size;
                        self.uploadNextSlices();
                    } else { // 全部分片上传完毕

                        // 回调：传递进度（100%）
                        self.ops.onprogress(self.file.size, self.file.size, self.file, self);
                        self.uploadCompleted(r);
                    }
                },
                error : function(err) {
                    window.console && console.log("upload remained slices error: ", err);

                    // 上传出错
                    self.ops.onuploadError(self.file);
                }
            });
        }
        reader.readAsDataURL( blob ); // 试下别的
    }

    // 所有分片上传完毕 / 妙传成功
    Uploader.prototype.uploadCompleted = function(r) {
        window.console && console.log("upload finished:", this.file);
        this.state.uploading = false;
        this.state.succeed = true;

        // 回调：单个文件上传完毕，onfileUploaded
        this.ops.onfileUploaded(this.file, r);
    }

    // 以下为Uploader实例的api **********************************************

    // 将上传列表中的文件上传
    Uploader.prototype.upload = function() {
        if (this.state.succeed) {
            return;
        } else if (this.state.uploading) {
            return;
        } else {
            this.uploadFirstSlice();
        }
    }

    // 暂停上传
    Uploader.prototype.pause = function() {
        if (this.state.uploading) {
            this.state.uploading = false;
        }
    }

    // 继续上传
    Uploader.prototype.resume = function() {
        if (!this.state.uploading) {
            this.state.uploading = true;
            this.uploadNextSlices();
        }
    }

    // 取消上传
    Uploader.prototype.cancle = function() {
        this.pause();
    }

// =======================================================================================================================================

    window.QCloudUpload = function(op) {
        this.ops = op;
        this.ops.uploadUrl = op.uploadUrl || "http://web.video.myqcloud.com/files/v1/", // 上传服务器的host
        self.fileList = [];     // 正在上传的文件列表，每次选中文件后做push判断
        self.uploaderList = {}; // 上传时，@self.fileList中的每个文件都一一对应一个uploader对象{},元素为 ： fileName : uploaderObj
        self.eventList = {};    // 用于订阅模式的事件队列
    }

    // 调用实例的@add方法时，针对每个文件生成一个对应的上传对象，并保存在@uploaderList中
    QCloudUpload.prototype._initUploader = function() {
        var self = this;
        var fileList = self.fileList;
        for (var i = 0, len = fileList.length; i < len; ++i) {
            var file = fileList[i];
            var name = file.name;
            var eventList = self.eventList;

            // uploaderList对象中没有与文件对应的上传器时，初始化一个上传器
            if (!self.uploaderList[name]) {

                // 初始化一个新的Uploader并保存
                self.uploaderList[name] = new Uploader(file, {
                    uploadUrl : self.ops.uploadUrl,
                    onfileReadError  : function(file, reader, uploader) {
                        return self.trigger("fileReadError", arguments);
                    },

                    onfileUploaded : function(file, successResult) {
                        if (self.ops.onfileUploaded) {
                            self.ops.onfileUploaded(file, successResult);

                            // 监测是否全部上传完毕
                            if (self.isAllUploaded() && self.ops.onallCompleted) {
                                self.ops.onallCompleted(self.fileList, self);
                            }
                        }
                    },
                    onprogress : function(offset, size, file, uploader) {
                        self.ops.onprogress && self.ops.onprogress(offset, size, file, uploader);
                    },
                    onuploadError : function(file) {
                        self.ops.onuploadError && self.ops.onuploadError(file);
                    },
                    onreadFileStart : function(file) {
                        self.ops.onreadFileStart && self.ops.onreadFileStart(file);
                    },
                    onreadFileEnd : function(file) {
                        self.ops.onreadFileEnd && self.ops.onreadFileEnd(file);
                    },
                });
            }
        }
    }

    // api ***************************************************

    // 将选中的文件@files（onChange获取的e.target.files对象）添加到上传列表
    QCloudUpload.prototype.add = function(files) {
        for (var i = 0, len = files.length; i < len; ++i) {
            this.fileList.push(files[i]);
        }

        // 初始化每个视频的上传器
        this._initUploader();
    }

    // 检查上传列表中是否存在名为@fileName的文件
    QCloudUpload.prototype.checkExist = function(fileName) {
        var fileList = this.fileList;
        for (var i = 0, len = fileList.length; i < len; ++i) {
            if (fileList[i].name === fileName) {
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
        var name = "";
        for (name in this.uploaderList) {
            this.uploaderList[name].upload();
        }
    }

    // 全部暂停上传
    QCloudUpload.prototype._pauseAll = function() {
        var name = "";
        for (name in this.uploaderList) {
            this.uploaderList[name].pause();
        }
    }

    // 全部继续上传
    QCloudUpload.prototype._resumeAll = function() {
        var name = "";
        for (name in this.uploaderList) {
            this.uploaderList[name].resume();
        }
    }

    // 全部取消上传
    QCloudUpload.prototype._cancleAll = function() {
        var name = "";
        for (name in this.uploaderList) {
            this.uploaderList[name].cancle();
        }
    }

    // 取消对文件的读取(在reader执行onload前执行abort)
    QCloudUpload.prototype.cancleFileRead = function(name) {
        var self = this;

    }

    // 添加订阅模式
    QCloudUpload.prototype.on = function(key, fn) {
        var eventList = this.eventList; // {}
        if (!eventList[key]) {
            eventList[key] = [];
        }
        eventList.push(fn);
    }

    QCloudUpload.prototype.off = function(key, fn) {
        var eventList = this.eventList;
        if (!eventList[key]) {
            return;
        } else {
            var fnList = eventList[key];
            for (var i =0, len = fnList.length; i < len; ++i) {
                if (fnList[i] === fn) {
                    fnList.splice(i, 1);
                }
            }
        }
    }

    QCloudUpload.prototype.trigger = function(key, args) {
        var eventList = this.eventList;
        var files = this.fileList;
        if (!eventList[key] || !eventList[key].length) {
            return false;
        } else {
            var fnList = eventList[key];
            for (var i =0, len = fnList.length; i < len; ++i) { // on订阅的事件依次全部执行
                fnList[i].apply(args[0], args);
            }
        }
    }

})(jQuery);









