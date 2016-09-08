/**
* 只能上传一部视频的上传组件
* 文档：http://gitlab.corp.anjuke.com/yaohuiwang/qcloudupload-js/tree/master
*/
;APF.Namespace.register("ajk");
(function($, ns) {
    ns.VideoUploadClass = function(op) {
        var self = this;
        self.defaults = {
            fileIptSlter     : "#fileSlter",
            getUpArgsApi     : "/ajax/house/mediaUpload?action=upload",
            maxSize          : 300 * 1024 * 1024,                         // 可以上传文件的最大体积，byte(B)
            hostName         : "http://web.video.myqcloud.com/files/v1/", // 上传服务器的host
            appid            : "10011010",
            acceptedFormat   : "avi,wmv,mpeg,mp4,mov,flv,3gp"            // 可以上传的文件的类型字符串,以逗号分隔，传false时不限制格式
        };
        self.ops = $.extend({}, self.defaults, op);
        self.nodes = {
            fileIpt : $(self.ops.fileIptSlter)
        };

        // 上传的路径参数，每个视频都从@getUpArgsApi接口获取
        self.upArgs = {
            bucketName : "",
            path : "",
            sign : "",
            uploadUrl : ""
        };
        self.uploader = new QCloudUpload();
        this.fileList = [];
        this.eventList = {};
        self.init();
    }

    ns.VideoUploadClass.prototype.init = function() {
        var self = this;
        self.bindUploadEvent(); // 绑定上传逻辑
        self.bindEvent(); // 绑定交互逻辑
    }

    // 用于获取文件的上传地址
    ns.VideoUploadClass.prototype.getUploadArgs = function(callback) {
        var self = this;
        $.ajax({
            url : self.ops.getUpArgsApi,
            type : "get",
            dataType : "json",
            data : {},
            success : function(r) {
                if (r.data.sign) {
                    callback && callback( self.ops.hostName + self.ops.appid + "/" + r.data.bucketName + r.data.path + "?sign=" + encodeURIComponent(r.data.sign) );
                } else {
                    window.console && console.error(">> 获取上传参数失败");
                }
            },
            error : function(err) {
                window.console && console.log(">> 获取上传参数失败");
            }
        });
    }

    ns.VideoUploadClass.prototype.bindUploadEvent = function() {
        var self = this;
        var uploader = self.uploader;

        // 添加后立即上传
        uploader.on("addFile", function(file) {
            this.upload(); // 下面的事件会被依次触发
        });

        // 开始读取文件，
        uploader.on("fileReadStart", function(reader) {
            self.handleFileReadStart(reader);
        });

        // 读取文件进度
        uploader.on("fileReadProgress", function(progress) {
            self.fileReadProgress(progress);
        });

        // 读取完毕
        uploader.on("fileReadEnd", function(reader) {
            self.handleFileReadEnd(reader);
        });

        // 读取出错
        uploader.on("fileReadError", function(reader) {
            self.handleFileReadError(reader);
        });

        // 开始上传
        uploader.on("uploadStart", function() {
            self.handleUploadStart();
        });

        // 上传中
        uploader.on("uploadProgress", function() {
            self.handleUploadProgress();
        });

        // 上传完毕
        uploader.on("uploadEnd", function(result) {
            self.handleUploadEnd(result);
        });

        // 上传出错
        uploader.on("uploadError", function() {
            self.handleUploadError();
        });
    }

    ns.VideoUploadClass.prototype.bindEvent = function() {
        var self = this;

        // 绑定: 从文件域添加文件
        self.nodes.fileIpt.on("change", function(e) {
            var file = e.target.files[0];
            if ( !self.checkFile(file) ) {
                return;
            }
            self.getUploadArgs(function(uploadUrl) {
                file.uploadUrl = uploadUrl;
                self.uploader.add(file);
            });
        });
    }

    // 检查文件是否符合要求，并执行错误提示
    ns.VideoUploadClass.prototype.checkFile = function(file) {
        var self = this;
        var name = file.name;
        var format = name.split(".").pop();
        var tip = "";
        var result = true;
        if ( file.size > +self.ops.maxSize ) { // 尺寸错误
            tip = self.ops.sizeTip;
            result = false;
        } else if ( self.ops.acceptedFormat !== "*" && (name.indexOf(".") === -1 || self.ops.acceptedFormat.indexOf(format) === -1) ) { // 格式错误
            tip = self.ops.formateTip;
            result = false;
        }
        self.handleError(tip);
        return result;
    }

    ns.VideoUploadClass.prototype.handleFileReadStart = function(reader) {
        var self = this;
    }

    ns.VideoUploadClass.prototype.fileReadProgress = function(progress) {
        var self = this;
    }

    ns.VideoUploadClass.prototype.handleFileReadEnd = function(reader) {
        var self = this;
    }

    ns.VideoUploadClass.prototype.handleFileReadError = function(reader) {
        var self = this;
    }

    ns.VideoUploadClass.prototype.handleUploadStart = function() {
        var self = this;
    }

    ns.VideoUploadClass.prototype.handleUploadProgress = function() {
        var self = this;
    }

    ns.VideoUploadClass.prototype.handleUploadEnd = function() {
        var self = this;
    }

    ns.VideoUploadClass.prototype.handleUploadError = function() {
        var self = this;
    }

    // 选择的文件不符合要求
    ns.VideoUploadClass.prototype.handleError = function(tip) {
        var self = this;
    }

})(jQuery, ajk);



















