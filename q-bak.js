(function($) {

    // Uploader为用于上传文件的类，供组件类[@VideoUploadClass]内部使用，一个Uploader实例对应一部视频上传
    var Uploader = function(file, op) {
        var self = this;
        self.defaults = {
            getUploadArgsApi : "/ajax/house/mediaUpload?action=upload",
            hostName         : "http://web.video.myqcloud.com/files/v1/",
            appid            : "10011010"
        };
        self.ops = $.extend({}, self.defaults, op);

        // 用于上传的参数，异步获取
        self.upArgs = {
            bucketName : self.ops.bucketName || "",
            path : self.ops.path || "",
            sign : self.ops.sign || "",
            uploadUrl : self.ops.uploadUrl || "" // 在指定路径下创建视频
        };

        // 分片信息，第一片返回时初始化
        self.offset = "";
        self.session = "";
        self.slice_size = "";

        // 上传的状态
        self.state = {
            uploading : false, // 上传中
            succeed   : false, // 上传完毕
            speed     : "",    // 上传速度（KB/s）
            remain    : ""     // 剩余时间
        };

        // 被上传的文件
        self.file = file;
    }

    // 读取文件的部分内容，兼容不同浏览器
    Uploader.prototype.blobSlice = function(blob, startByte, endByte) {
        var self = this;
        if (blob.slice) {
            return blob.slice(startByte, endByte);
        } else if (blob.webkitSlice) {
            return blob.webkitSlice(startByte, endByte);
        } else if (blob.mozSlice) {
            return blob.mozSlice(startByte, endByte);
        } else {
            return null;
        }
    }

    // 填充formData
    Uploader.prototype.appendFormData = function(formData, data) {
        var self = this;
        $.each(data, function(k, v) {
            formData.append(k, v);
        });
    }

    // 上传第一片
    Uploader.prototype.uploadFirstSlice = function(callback) {
        var self = this;
        var reader = new FileReader();
        var formData = new FormData();
        var file = self.file;
        reader.onerror = function() {
            if ( !self.ops.onfileReadError(self.file, self) ) {
                ajk.alert && ajk.alert("文件读取错误：" + self.file.name);
                window.console && console.error("error occured: ", reader.error);
            }
        };
        reader.onload = function(e) {
            if (!hex_sha1) {
                window.console && console.error("sha算法的文件未引入");
            }
            self.appendFormData(formData, {
                op : "upload_slice", // 第一片固定值*
                filesize : file.size, // 视频文件总大小*
                sha : hex_sha1(reader.result) // 文件的sha值,必须提供*
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
                url : self.upArgs.uploadUrl,
                data : formData,
                dataType : "json",
                processData : false,
                contentType : false,
                success : function(r) {

                    // 妙传成功
                    if (r.data.access_url) {
                        self.uploadCompleted(r);
                        return;
                    }
                    window.console && console.log("开始上传，文件大小：", file.size);
                    self.offset = r.data.offset;
                    self.session = r.data.session;
                    self.slice_size = r.data.slice_size;
                    self.state.uploading = true;
                    self.uploadNextSlices();
                },
                error : function(err) {
                    self.ops.onuploadError(file, err);
                }
            });

            // 回调：读取文件完毕
            self.ops.onreadFileEnd(self.file);
        };
        // reader.readAsDataURL( file );
        reader.readAsBinaryString( file );

        // 回调：开始读取文件
        self.ops.onreadFileStart(file);
    }

    // 上传后续分片
    Uploader.prototype.uploadNextSlices = function() {
        var self = this;

        // 暂停中或已完成
        if ( !self.state.uploading ) {
            window.console && console.log("已暂停");
            return false;
        }
        var reader = new FileReader();
        var formData = new FormData();
        var file = self.file;
        var blob = self.blobSlice(file, self.offset, self.offset + self.slice_size);
        if ( false && self.offset + self.slice_size >= file.size ) { // 最后一片
            window.console && console.log("last piece")
            blob = self.blobSlice(file, self.offset, file.size);
        }
        reader.onerror = function() {
            window.console && console.log("read file error")
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
                url : self.upArgs.uploadUrl,
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

                        // 回调：传递进度
                        self.ops.onprogress(self.file.size, self.file.size, self.file, self);
                        self.uploadCompleted(r);
                    }
                },
                error : function(err) {
                    window.console && console.log("upload remained slice error: ", err);

                    // 上传出错
                    self.ops.onuploadError(self.file);
                }
            });
        }
        reader.readAsDataURL( blob );
    }

    // 所有分片上传完毕 / 妙传成功
    Uploader.prototype.uploadCompleted = function(r) {
        var self = this;
        window.console && console.log("upload finished!");
        self.state.uploading = false;
        self.state.succeed = true;
        self.file.uploadSucceed = true;

        // 回调：单个文件上传完毕，onfileUploaded
        self.ops.onfileUploaded(self.file, r);
    }

    // 以下为Uploader实例的api **********************************************

    // 将选中的文件上传
    Uploader.prototype.upload = function() {
        var self = this;
        if (self.state.succeed) {
            window.console && console.log("此文件已上传过：", self.file)
            return;
        } else if (self.state.uploading) {
            window.console && console.log("文件正在上传中", self.file);
            return;
        } else {
            self.getUploadArgs(function() {
                self.uploadFirstSlice();
            });
        }
    }

    // 暂停上传
    Uploader.prototype.pause = function() {
        var self = this;
        if (self.state.uploading) {
            window.console && console.log("触发了暂停操作");
            self.state.uploading = false;
        }
    }

    // 继续上传
    Uploader.prototype.resume = function() {
        var self = this;
        if (!self.state.uploading) {
            self.state.uploading = true;
            self.uploadNextSlices();
        }
    }

    // 取消上传
    Uploader.prototype.cancle = function() {
        var self = this;
        self.pause();
    }

// =======================================================================================================================================

    window.QCloudUpload = function(op) {
        var self = this;
        self.defaults = {
            sizeToSlice      : null,                                      // 超过多大的文件需要分片上传（B），默认全分片
            maxUpNumOnce     : 1,                                         // 同时可以上传多少个
            maxUpNumAll      : 1,                                         // 一共可以上传多少个
            minSize          : 0,                                         // 可以上传文件的最大体积，byte(B)，默认无限制
            maxSize          : 300 * 1024 * 1024,                         // 可以上传文件的最大体积，byte(B)
            hostName         : "http://web.video.myqcloud.com/files/v1/", // 上传服务器的host
            appid            : "10011010",
            acceptedFormat   : "avi,wmv,mpeg,mp4,mov,flv,3gp",            // 可以上传的文件的类型字符串,以逗号分隔，传false时不限制格式
        };
        self.ops = $.extend({}, self.defaults, op);
        self.fileList = [];     // 正在上传的文件列表，每次选中文件后做push判断
        self.uploaderList = {}; // 上传时，@self.fileList中的每个文件都一一对应一个uploader对象{},元素为 ： fileName : uploaderObj
        self.eventList = {};    // 用于订阅模式的事件队列
        self.init();
    }

    QCloudUpload.prototype.init = function() {
        var self = this;
    }

    // 调用实例的@add方法时，针对每个文件生成一个对应的上传对象，并保存在@uploaderList中
    QCloudUpload.prototype._initUploader = function() {
        var self = this;
        var fileList = self.fileList;
        for (var i = 0, len = fileList.length; i < len; ++i) {
            var file = fileList[i];
            var name = file.name;

            if (!self.uploaderList[name]) {

                // 初始化一个新的Uploader
                self.uploaderList[name] = new Uploader(file, {
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
                    onfileReadError  : function(file, uploader) {
                        if (self.ops.onfileReadError) {
                            self.ops.onfileReadError(file, uploader);
                        } else {
                            return false;
                        }
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
                    getUploadArgsApi : self.ops.getUploadArgsApi,
                    hostName         : self.ops.hostName,
                    appid            : self.ops.appid
                });
            }
        }
    }

    // api ***************************************************

    // 将选中的文件@files（onChange获取的e.target.files对象）添加到上传列表
    QCloudUpload.prototype.add = function(files) {
        var self = this;
        var sltedFiles = files;
        var wrongFormatList = []; // 不符合格式的文件
        var overflowList = [];    // 超出个数的文件
        var wrongSizeList = [];   // 大小不符合要求的文件
        var repeatedList = [];    // 重复选择的文件
        for (var i = 0, len = sltedFiles.length; i < len; ++i) {
            var file = sltedFiles[i];
            var name = file.name;
            var format = name.split(".").pop();
            var size = file.size; // B

            // 有格式要求
            if ( self.ops.acceptedFormat !== "*" && (name.indexOf(".") === -1 || self.ops.acceptedFormat.indexOf(format) === -1) ) { // 格式错误
                wrongFormatList.push(file);
                continue;
            } else { // 格式正确

                // 检查体积限制
                if (size < self.ops.minSize || size > self.ops.maxSize) {
                    wrongSizeList.push(file);
                    continue;
                } else { // 体积符合要求

                    // 检查是否有重复的文件
                    if (self.checkExist(name)) {
                        repeatedList.push(file);
                        continue;
                    } else { // 没有重复

                        // 检查总数量
                        var curNum = self.fileList.length; // 当前正在上传列表中的文件个数
                        if ( curNum >= +self.ops.maxUpNumAll ) {
                            overflowList.push(file);
                            continue;
                        } else {
                            file.video_title = file.name;
                            self.fileList.push(file);
                        }
                    }
                }
            }
        }

        // 执行回调
        self.ops.onformatError && self.ops.onformatError(wrongFormatList, self);
        self.ops.onsizeError && self.ops.onsizeError(wrongSizeList, self);
        self.ops.onnumError && self.ops.onnumError(overflowList, self);
        self.ops.onrepeatError && self.ops.onrepeatError(repeatedList, self);

        // 初始化每个视频的上传器
        self._initUploader();
    }

    // 检查上传列表中是否存在名为@fileName的文件
    QCloudUpload.prototype.checkExist = function(fileName) {
        var self = this;
        var fileList = self.fileList;
        for (var i = 0, len = fileList.length; i < len; ++i) {
            if (fileList[i].name === fileName) {
                return true;
            }
        }
        return false;
    }

    // 监测是否所有文件都已经上传完毕
    QCloudUpload.prototype.isAllUploaded = function() {
        var self = this;
        var uploaderList = self.uploaderList;
        var result = true;

        $.each(uploaderList, function(name, uploader) {
            if (!uploader.state.succeed) {
                result = false;
            }
        });

        return result;
    }

    // 上传文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.upload = function(name) {
        var self = this;
        if (!name) {
            self._uploadAll();
        } else if(self.uploaderList[name]) {
            self.uploaderList[name].upload();
        }
    }

    // 暂停文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.pause = function(name) {
        var self = this;
        if (!name) {
            self._pauseAll();
        } else if(self.uploaderList[name]) {
            self.uploaderList[name].pause();
        }
    }

    // 继续文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.resume = function(name) {
        var self = this;
        if (!name) {
            self._resumeAll();
        } else if(self.uploaderList[name]) {
            self.uploaderList[name].resume();
        }
    }

    // 取消文件名为@name的上传进程，只有一个文件时@name可不传
    QCloudUpload.prototype.cancle = function(name) {
        var self = this;
        if (!name) {
            self._cancleAll();
        } else if(self.uploaderList[name]) {
            self.uploaderList[name].cancle();
            delete self.uploaderList[name];
        }
    }

    // 全部上传
    QCloudUpload.prototype._uploadAll = function() {
        var self = this;
        $.each(self.uploaderList, function(name, uploader) {
            uploader.upload();
        });
    }

    // 全部暂停上传
    QCloudUpload.prototype._pauseAll = function() {
        var self = this;
        $.each(self.uploaderList, function(name, uploader) {
            uploader.pause();
        });
    }

    // 全部继续上传
    QCloudUpload.prototype._resumeAll = function() {
        var self = this;
        $.each(self.uploaderList, function(name, uploader) {
            uploader.resume();
        });
    }

    // 全部取消上传
    QCloudUpload.prototype._cancleAll = function() {
        var self = this;
        $.each(self.uploaderList, function(name, uploader) {
            uploader.cancle();
            delete self.uploaderList[name];
        });
    }

    // 取消对文件的读取(在reader执行onload前执行abort)
    QCloudUpload.prototype.cancleFileRead = function(name) {
        var self = this;

    }

    // 添加订阅模式
    QCloudUpload.prototype.on = function(key, fn) {
        var self = this;
        var eventList = self.eventList;
        if (!eventList[key]) {
            eventList[key] = [];
        }
        eventList.push(fn);
    }

    QCloudUpload.prototype.off = function(key, fn) {
        var self = this;
        var eventList = self.eventList;
        if (!eventList[key]) {
            return;
        }
    }

    QCloudUpload.prototype.once = function(key, fun) {
        var self = this;

    }

    QCloudUpload.prototype.trigger = function(key) {
        var self = this;

    }

})(jQuery);









