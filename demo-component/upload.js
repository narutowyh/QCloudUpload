/**
*
*/
;APF.Namespace.register("ajk");
(function($, ns) {
    ns.VideoUploadClass = function(op) {
        var self = this;
        self.defaults = {
            fileIptSlter : "",
            getUpArgsApi     : "/ajax/house/mediaUpload?action=upload",
            maxUpNumOnce     : 1,                                         // 同时可以上传多少个
            maxUpNumAll      : 1,                                         // 一共可以上传多少个
            minSize          : 0,                                         // 可以上传文件的最大体积，byte(B)，默认无限制
            maxSize          : 300 * 1024 * 1024,                         // 可以上传文件的最大体积，byte(B)
            hostName         : "http://web.video.myqcloud.com/files/v1/", // 上传服务器的host
            appid            : "10011010",
            acceptedFormat   : "avi,wmv,mpeg,mp4,mov,flv,3gp",            // 可以上传的文件的类型字符串,以逗号分隔，传false时不限制格式
        };
        self.ops = $.extend({}, self.defaults, op);
        self.nodes = {
            fileIpt : $(self.ops.fileIptSlter)
        };
        self.upArgs = {
            bucketName : self.ops.bucketName || "",
            path : self.ops.path || "",
            sign : self.ops.sign || "",
            uploadUrl : self.ops.uploadUrl || "" // 在指定路径下创建视频
        };
        self.uploader = null;
        self.init();
    }

    ns.VideoUploadClass.prototype.init = function() {
        var self = this;
        self.getUploadArgs(function() {
            self.initUploaderEvent();
            self.bindEvent();
        });
    }

    ns.VideoUploadClass.prototype.getUploadArgs = function(callback) {
        var self = this;

        $.ajax({
            url : self.ops.getUpArgsApi,
            type : "get",
            dataType : "json",
            data : {},
            success : function(r) {
                self.upArgs.bucketName = r.data.bucketName;
                self.upArgs.path = r.data.path;
                self.upArgs.sign = encodeURIComponent(r.data.sign);
                self.upArgs.uploadUrl = self.ops.hostName + self.ops.appid + "/" + self.upArgs.bucketName + self.upArgs.path + "?sign=" + self.upArgs.sign;
                callback && callback();
            },
            error : function(err) {
                window.console && console.log("上传字段请求出错");
            }
        });
    }

    ns.VideoUploadClass.prototype.initUploaderEvent = function() {
        var self = this;
        self.uploader =new QCloudUpload({
            uploadUrl : self.upArgs.uploadUrl
        });
        var uploader = self.uploader;
        uploader.on("addFile", function(file) {
            // this.upload();
        });

        uploader.on("fileReadStart", function(file) {
            // window.console && console.log("fileReadStart", this);
        });

        uploader.on("fileReadProgress", function(progress) {
            // window.console && console.log("fileReadProgress", this);
            // window.console && console.log(this.state.);
            $("#progress").html(progress.loaded / progress.total * 100 + "%");
        });

        uploader.on("fileReadEnd", function(file) {
            // window.console && console.log("fileReadEnd", this);
        });

        uploader.on("uploadStart", function(file) {
            window.console && console.log("uploadStart", this);
        });

        uploader.on("uploadProgress", function(file) {
            window.console && console.log("uploadProgress", this);
            // this.pause()
        });

        uploader.on("uploadEnd", function(file) {
            window.console && console.log("uploadEnd", this);
        });

        uploader.on("uploadPause", function(file) {
            window.console && console.log("uploadPause", this);
        });

        uploader.on("uploadResume", function(file) {
            window.console && console.log("uploadResume", this);
        });

        uploader.on("uploadError", function(file) {
            window.console && console.log("uploadError", this);
            debugger
        });
    }

    ns.VideoUploadClass.prototype.bindEvent = function() {
        var self = this;

        // 绑定: 从文件域添加文件
        self.nodes.fileIpt.on("change", function(e) {
            if (self.uploader) {
                self.uploader.add(e.target.files);
            }
        });

        // 绑定 ： 开始
        $("#beginUpload").on("click", function(e) {
            self.uploader.upload();
        });

        // 绑定 ： 暂停
        $("#pause").on("click", function(e) {
            self.uploader.pause();
        });

        // 绑定 ： 继续
        $("#resume").on("click", function(e) {
            self.uploader.resume();
        });

        // 绑定 ： 取消
        $("#cancle").on("click", function(e) {
            self.uploader.cancle();
        });
    }
})(jQuery, ajk);



















