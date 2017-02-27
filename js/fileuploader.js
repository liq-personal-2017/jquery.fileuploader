/// <reference path="C:\inetpub\wwwroot\fileupload\fileupload\lib\jquery.1.9.1.js" />

/*
* 说明：1、这个程序本身并不考虑传输的问题，保证传输的正确性这件事应该由浏览器来做，程序认为每次传输都是正确的，如果失败了，则直接导致这个文件的传输失败
        2、关于断点传输-因为javascript的fileAPI本身很弱，并且不具备直接访问物理文件的功能，也无法访问文件的具体路径，所以纯javascript是无法实现断点传输的（另，曾经其实想过把当前的file对象直接存储到数据库中，下回从数据库取出来以进行“断点传输”，艾玛，我都存到数据库了，为啥还要拿出来重新上传，【笑】）
        3、关于事件，所有的事件都注册在元素本身上面，这样可以由编程人员直接在元素上注册事件，比如change事件，控件中就没有提供默认的初始化，但是有触发
        4、关于安全，本程序上传的参数都是直接添加在url上的，不要考虑安全的问题，如果需要考虑安全的问题，请使用HTTPS


* 目标：摒弃直接调用事件的方式，改成使用jQuery事件，但是jQuery.fn.trigger 并不能获取事件返回值，所以这里改成jQuery.event.trigger()【部分事件需要根据返回值决定是否继续】
* 后台只有一个service，可以处理上传，下载，删除，不考虑数据库读写
    理论上来说fileid应该是一个任意的字符串，后端以fileid以及filename能正确的定位到文件即可，所以其实也可以为空，但是为空的话前端就需要特殊的处理，以保证后端文件不会冲突才行
* 上传部分：这只是一个单纯的上传控件，后端将不会处理文件名，由前端进行控制，并且告诉后端是否允许覆盖文件--ok
    {
        opration ,操作类型【这里应该写upload】
        filesize ,文件大小【方便后端计算是否传输完毕】
        filestep ,单次上传的大小【后端可以以此作为容器大小、也可以循环】
        filename ,文件名【文件名】
        isoverwrite ,是否允许覆盖【如果为false，后端检测到文件存在的话将抛出异常】
        offset ,偏移量【当前传输的内容在文件流的位置】
        fileid ,额外参数【如果用真实文件名进行存储的话，文件名可能会出现冲突，加上一个参数方便后端进行区分，这个参数每初始化一个控件就需要给一个，如果没给，后端程序也没有处理的话，可能会出现未知的错误】
    }
* 下载部分：理论上来说这个应该是只处理上传的功能，所以下载的功能很弱，前端将处理成一个简单的<a>，由后端处理响应头以使浏览器发起下载--ok
    {
        opration ,操作类型【downlaod】
        filename ,文件名
        fileid ,额外参数
    }
* 删除部分：同下载部分，删除只是一个附加的功能，由前端发送删除请求，--ok
    {
        opration ,操作类型【delete】
        filename ,文件名
        fileid ,额外参数
    }
* 支持事件：
    {
        "beforeupload.fileuploader": 文件上传之前【根据返回值确定是否继续】ok
        , "fileuploadend.fileuploader": 文件上传之后【控件刷新之后】ok
        , "alluploadend.fileuploader": 所有文件上传之后【控件刷新之后】--这个涉及到计数问题--ok
        , "beforedelete.fileuploader": 文件删除之前【根据返回值确定是否继续】ok
        , "deleteend.fileuploader": 文件删除之后【控件刷新之后】ok
        , 'beforedownload.fileuploader': 文件下载之前【根据返回值确定是否继续】ok
        , 'downloadend.fileuploader': 文件下载之后【根据返回值确定是否继续】ok
        --后续
            change 发生变化，即删除之后和所有上传结束之后--ok
            beforeallupload 第一次上传之前，因为以前有过一个很诡异的要求:
                            我们做的gis，有一组shp文件，在操作中是一个个体，但是作为文件系统来看，却又是一组（六个-其实只要四个就可以用）文件，所以会在上传之前校验一下文件类型，文件名，所以添加一个事件
                            原来做的时候直接把这个功能嵌入到控件里面来了，但是我想来想去都觉得不是很合理
                            这里改一下，加一个事件，用户可以直接在上传之前获取到当前上传的文件数据，以及控件中已有的所有文件数据，以此可以判断是否允许上传
                            --这个事件也就需要返回值，除非明确返回false，否则认为可以上传
    };
* 配置
    {
        按钮汉字 btntext，ok
        按钮样式 btnclass，ok
        文件类型 extname，ok
        上传步长 step，ok
        上传服务路径 url， ok
        是否多选 multiple，ok

        是否允许删除 【通过beforedelete实现】，
        是否允许下载 【通过beforedownload实现】，
        上传文件最大数量，ok
        是否可用, ok
        相同文件名 samefilename 配合beforeallupload使用，此处仅强制上传的文件会使用同一个文件名（后缀名应该不同），

        单个文件大小限制：fileUploadSizeMax: 1000000, KB为单位

    }
* 方法
    {
        getoptions : 获取当前控件的配置 ok
        getcontent : 获取当前控件的内容【数组：[{FileContent}]】 ok
        getfilecount : 获取当前控件上传的文件数量 ok
        loadcontent : 加载数据 ok
        
        disable : 设置/获取 可用状态 ok

        删除所有 | 删除单个文件的功能，可以自行调用后台删除文件后，重新绑定列表即可
    }
*/
(function ($)
{
    'use strict';
    var FileUploader = function ($el, options)
    {
        this.$el = ($el);
        this.filecount = 0;
        this.files = [];
        this.$container = null;
        this.options = $.extend({}, FileUploader.DEFAULTOPTS, options);
        this.init();
        this.count2upload = 0;
        this.countuploaded = 0;

    };
    //文件内容的标准格式，有这几个就够了，本来打算再有一个file的引用，但是考虑到内存问题，这里去除了对file二进制的引用。对文件的二进制引用应该是在上传完毕之后直接释放，不能再任何地方继续引用，否则可能会造成内存占用无法释放，在js中尤其要考虑这种问题
    var FileContent = function (filename, filesize, filecode, extdata)
    {
        this.filename = filename;
        this.filesize = filesize;
        this.filecode = filecode;
        this.extdata = extdata;
    }


    var ajaxFailCall = function (message)
    {
        alert(message);
    }

    FileUploader.DEFAULTOPTS = {
        css: {
            width: '100%', height: '100%'
        },
        btnclass: 'btn btn-primary',
        multiple: false,
        extnames: ';.txt;.doc;.bmp;.jpg;.gif;.xls;.rar;.docx;.xlsx;.pdf;',
        btntext: '添加文件',
        step: 10240,
        fileid: '',
        url: '',
        isoverwrite: 'true',
        fileuploadcountmax: 0,
        disable: false,
        samefilename: false,
        fileuploadsizemax: 1000000,
    };

    var log = function ()//日志方法最后应该被删除，这里保存一个实现，没有用到这份代码
    {
        console.log.apply(null, arguments);
    };
    var warn = function (message)
    {
        console.warn(message);
    };
    var error = function (message)
    {
        $.error(message);
    };

    var sendBlobt2Server = function (url, data)
    {
        //方法，将一个blob发送到指定的url
        //实际上是将jquery ajax封装了一下，并且也不一定是发送blob，普通数据也可以，但是普通的数据会变成类似get方式发送（参数附加在url后面）
        var blob;
        if (hasOwnProperty.call(data, 'blob'))
        {
            blob = data.blob;
            delete data.blob;
        }
        if (data)
        {
            var param = $.param(data);
            if (param != '' && /\?/g.test(url))
            {
                url += '&' + param;
            } else
            {
                url += '?' + param;
            }
        }
        var opt = $.extend({}, data, {
            contentType: 'application/octet-stream',
            data: blob,
            processData: false,
            dataType: 'text',
            type: 'POST'
        });
        return $.ajax(url, opt);
    };


    var post2Server = function (url, data)
    {
        return $.ajax(url, {
            type: 'post',
            data: data,
            dataType: 'text'
        });
    };


    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var slice = Array.prototype.slice;

    var stringFormat = function (str)
    {
        var str2 = str;
        var args = slice.call(arguments, 1);
        $.each(args, function (i, a)
        {
            if (['string', 'number', 'boolean'].indexOf(typeof (a)) > -1)
            {
                str2 = str2.replace(new RegExp(['\\{', i, '\\}'].join(''), 'g'), a);
            } else if ('object' === typeof (a) && hasOwnProperty.call(a, 'tag') && hasOwnProperty.call(a, 'value'))
            {
                str2 = str2.replace(new RegExp(['\\{', a.tag, '\\}'].join(''), 'g'), a.value);
            } else
            {
                warn('stringFormat:Unsupport type[' + (typeof a) + ']');
            }
        });
        return str2;
    };
    //正常来说这样很浪费性能，不停的＋，跟java等意思一样，但是java会有编译过程，这个会被直接优化成一个字符串以节省性能
    //js中理论上来说如果使用[].join("")可以节省性能，但是如果使用代码压缩软件的话，这个就会发生变化，下面这种代码会被压缩成一个字符串
    //                                               如果使用数组就无法压缩，所以源码写的时候可以直接写成这种(jquery源码也是这么写的)
    var contanerTemplate = '<div class="fileupload-container">'
        + '<div class="input-file"><input type="button" class="{0}" value="{1}"/><input type="file" class="hidden" {2}/><span class="fileuploader-msg" title="点击清理" name="fileuploader-msg"></span></div>'
        + '<div class="div-table"><table></table></div>'
        + '</div>';
    var _supportList = ['input', 'div'];//变量，当前受支持元素列表
    var isSupport = function ($el)
    {
        //方法，判断当前元素是否受支持
        var support = false;
        var el = $el;
        $.each(_supportList, function (i, a)
        {
            if (el.is(a))
            {
                support = true;
                return false;
            }
            return true;
        });
        return support;
    };
    //默认的事件
    FileUploader.EVENTS = {
        'change.fileuploader': function ($e, type, data) { return true; }
        , 'beforeupload.fileuploader': function ($e, data) {  return true; }
        , 'fileuploadend.fileuploader': function ($e, data) { return true; }
        , 'fileuploaderror.fileuploader': function ($e, data) { return true; }
        , 'alluploadend.fileuploader': function ($e, data) { return true; }
        , 'beforedelete.fileuploader': function ($e, data) { return true; }
        , 'deleteend.fileuploader': function ($e, data) { return true; }
        , 'beforedownload.fileuploader': function ($e, data) { return true; }
        , 'downloadend.fileuploader': function ($e, data) { return true; }
        , 'beforeallupload.fileuploader': function ($e, data) { return true; }
    };
    //格式化日期，这个方法是一个工具方法，从别的项目中直接扒出来的，挺好用，当然本项目中用的很少，其实可以直接用原生的API，放在这里只是为了做个备份
    var formatDate = function (fmt, now)
    {
        var o = {
            'M+': now.getMonth() + 1,                 //月份   
            'd+': now.getDate(),                    //日   
            'h+': now.getHours(),                   //小时   
            'm+': now.getMinutes(),                 //分   
            's+': now.getSeconds(),                 //秒   
            'q+': Math.floor((now.getMonth() + 3) / 3), //季度   
            'S': now.getMilliseconds()             //毫秒   
        };
        if (/(y+)/.test(fmt))
            fmt = fmt.replace(RegExp.$1, (now.getFullYear() + '').substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp('(' + k + ')').test(fmt))
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
        return fmt;
    };
    var initFileCode = (function ()
    {
        var filecode = formatDate('yyyyMMddhhmmss', new Date());
        var i = 0;
        return function ()
        {
            return filecode + i++;
        }
    })();

    FileUploader.prototype = {
        constructor: FileUploader,
        init: function ()
        {
            this._initLayout();
            this._initInput();
            this._prepareEvent();
            this._initShowResult();
            this._setDisable(this.options.disable);
        },
        _on: function (type, listener)
        {
            //var args = arguments;
            return this.$el.on(type, listener);
        },
        _trigger: function (type, data)
        {
            var result = $.event.trigger(type.split('.')[0], data, this.$el[0]);
            if (undefined !== result)
            {
                return result;
            }
            return $.event.trigger(type, data, this.$el[0]);
        },
        _prepareEvent: function ()
        {
            var that = this;
            var op = that.options;
            $.each(FileUploader.EVENTS, function (type, listener)
            {
                if (op[type.split('.')[0]])
                {
                    that._on(type, op[type.split('.')[0]]);
                }
            });
        },

        _warn: function (msg)
        {
            warn(msg);
            return $('<span class="label label-warning"/>').text(msg).appendTo(this.$container.find('.fileuploader-msg'));
        },
        _error: function (msg)
        {
            error(msg);
            return $('<span class="label label-danger"/>').text(msg).appendTo(this.$container.find('.fileuploader-msg'));
        },

        _initLayout: function ()
        {
            var $el = this.$el;
            if (!isSupport($el))
            {
                that._error(['Unsupported Element:[', this.$el.prop('tagName'), ']'].join(''));
                return;
            } else
            {
                if ($el.is(':visible'))
                {
                    $el.addClass('hidden');
                }
                $el.wrap('<div></div>')
                this.$container = (this._getContainer()).appendTo(this.$el.parent());
            }
            if (this.options.css)
            {
                var ops = this.options.css;
                this.$container.css(ops);
            }
        },
        _getContainer: function ()
        {
            return $(stringFormat(contanerTemplate, this.options.btnclass, this.options.btntext, (this.options.multiple ? 'multiple="multiple"' : ''))).find('.fileuploader-msg').on('click', function ()
            {
                $(this).empty();
            }).end();
        },
        _initInput: function ()
        {
            var btn = this.$container.find('input[type=button]');
            var file = this.$container.find('input[type=file]');
            var that = this;
            btn.off('click').on('click', function ()
            {
                file.click();
            });
            file.on('change', function ()
            {
                that.count2upload = this.files.length;
                that.countuploaded = 0;

                if (that.options.fileuploadcountmax > 0 && that.count2upload + that.filecount > that.options.fileuploadcountmax)
                {
                    $(this).val('');//清空控件，防止不能触发change事件
                    that._warn("FileUploader:上传文件数量超出限制!");
                    return;
                }
                var filecontents = [];
                var files = [];
                var samefilename = that.options.samefilename;
                if (!(samefilename && 'string' === typeof (samefilename)))
                {
                    samefilename = null;
                }

                $.each(this.files, function (i, a)
                {
                    var extname = a.name.substr(a.name.lastIndexOf('.'));
                    var filecontent = new FileContent(samefilename ? samefilename + extname : a.name, a.size, initFileCode());
                    a.fileuploadcontent = filecontent;
                    filecontents.push(filecontent);
                    files.push(a);
                });
                if (false !== that._trigger('beforeallupload.fileuploader', [filecontents]))
                {
                    $.each(files, function (i, a)
                    {
                        var content = a.fileuploadcontent;
                        if (false !== that._trigger('beforeupload.fileuploader', content) && that._isCanUpload(content))
                        {
                            that._sendFile2Server(a);
                        } else
                        {
                            that.countuploaded++;
                        }
                    });
                } else
                {

                }
                $(this).val('');//清空控件，防止不能触发change事件
            });
        },
        _initShowResult: function ()
        {
            var that = this;
            that.$container.find('.div-table>table').empty();
            var _files = that.files;
            if (that.options.files && $.isArray(that.options.files))
            {
                var op = that.options;
                $.each(op.files, function (i, a)
                {
                    if ('string' === typeof a)
                    {
                        _files.push(new FileContent(a, -1, initFileCode(), a));
                    } else if ('object' === typeof a)
                    {
                        _files.push(new FileContent(a.filename, a.filesize, initFileCode(), a));
                    }
                });
                delete op.files;
            }
            that.files = _files;
            if (this.files.length > 0)
            {
                $.each(this.files, function (i, a)
                {
                    that._doShowResult(a, '100%');
                });
            }
            this.filecount = this.files.length;
        },
        _doShowResult: function (filecontent, current)
        {
            var filecode = filecontent.filecode;
            var that = this;
            var $tr = this.$container.find('.div-table>table tr[data-filecode=' + filecode + ']');
            if (!($tr.length))
            {
                $tr = $('<tr/>').attr('data-filecode', filecode).appendTo(this.$container.find('.div-table>table'));
                $tr.append(
                    stringFormat(
                      '<td>'
                    + '     <div class="alert-success div-file-manyvalues" name="div_download">'
                    + '          <a href="javascript:void(0);"  name="a_download" class="disabled fileresultcolorb" disabled="disabled" title="{0}" data-filename="{0}" data-filecode="{1}" data-url="{2}" data-fileid="{3}" >{0}</a>'
                    + '     </div>'
                    + '     <div class="progress margin1 alert-success" style="height:1px">'
                    + '          <div class="progress-bar"></div>'
                    + '     </div>'
                    + '</td>'
                    + '<td>'
                    + '     <div name="div_delete">'
                    + '         <a href="javascript:void(0);" name="a_delete" class="margin1 hidden" title="删除[{0}]" data-filename="{0}" data-filecode="{1}" data-url="{2}" data-fileid="{3}" >×</a>'
                    + '     </div>'
                    + '</td>', filecontent.filename, filecontent.filecode, this.options.url, this.options.fileid
                    )
                )
                .find('a[name=a_download]').off('click').on('click',
                (function (that)//这里通过这种方式来保存对当前控件的this的引用，因为所有控件共享这里的同一份代码，否则可能会串
                {
                    return function ($e)
                    {
                        var $this = $(this);
                        if (false !== that._trigger('beforedownload.fileuploader', new FileContent($this.data('filename'), -1, $this.data('filecode'))))
                        {
                            var $a = $('<a download target="_blank" />').attr('href', [$this.data('url'), '?opration=download&fileid=', $this.data('fileid'), '&filename=', $this.data('filename')].join('')).appendTo($('body'));
                            $a.get(0).click();
                            $a.remove();
                            that._trigger('downloadend.fileuploader', new FileContent($this.data('filename'), -1, $this.data('filecode')));

                        } else
                        {
                            that._warn('FileUploader:根据用户设置，不允许下载' + $this.data('filename'));
                        }
                    }
                })(that)).end().find('a[name=a_delete]').off('click').on('click',
                (function (that)
                {
                    return function ($e)
                    {
                        if (that.options.disable)//其实这里应该不需要处理，因为这里如果是disable状态，则理论上删除按钮是看不见的
                        {
                            return false;
                        }
                        //log($(this).data('filename'), $(this).data('filecode'))
                        var $this = $(this);
                        if (false !== that._trigger('beforedelete.fileuploader', new FileContent($this.data('filename'), -1, $this.data('filecode'))))
                        {
                            post2Server($this.data('url'), {
                                opration: 'delete',
                                fileid: $this.data('fileid'),
                                filename: $this.data('filename')
                            }).then(function (data)
                            {
                                if (data === '')
                                {
                                    var filecode = String($this.data('filecode'));
                                    that.files = that.files.filter(function (a)
                                    {
                                        if (a.filecode === filecode)
                                        {
                                            return false;
                                        }
                                        return true;
                                    });
                                    that._initShowResult();
                                    that._trigger('deleteend.fileuploader', new FileContent($this.data('filename'), -1, $this.data('filecode')));
                                    that._trigger('change', ['delete', new FileContent($this.data('filename'), -1, $this.data('filecode'))]);
                                } else
                                {
                                    that._error('删除失败：' + data);
                                }
                            })
                        } else
                        {
                            that._warn('FileUploader:根据用户设置，不允许删除' + $this.data('filename'));
                        }
                    }
                })(that));

            }

            if (current === '100%' || +current >= +filecontent.filesize)
            {
                $tr.find('div.progress-bar').css('width', '100%')
                    .end().find('a[name=a_download]').removeClass('disabled').removeAttr('disabled')
                    .end().find('a[name=a_delete]').removeClass('hidden', '');
            } else
            {
                current = +current / +filecontent.filesize;
                if (current > 1)
                {
                    current = 100;
                } else
                {
                    current = ~~(current * 100);
                }
                $tr.find('div.progress-bar').css('width', current + '%');
            }
        },

        _sendFile2Server: function (file)
        {
            var that = this;
            var url = that.options.url;
            var isOverwrite = that.options.isoverwrite;
            var filecontent = file.fileuploadcontent;
            that.files.push(filecontent);

            var filename = filecontent.filename;

            (function send(offset, step)
            {
                if (offset + step < file.size)
                {
                    sendBlobt2Server(url, {
                        opration: 'upload',
                        filename: filename,
                        filestep: step,
                        offset: offset,
                        filesize: file.size,
                        isoverwrite: isOverwrite,
                        blob: file.slice(offset, offset + step)
                    }).then(function (data)
                    {
                        if (data === '')
                        {
                            that._doShowResult(filecontent, offset);
                            send(offset + step, step);
                        } else
                        {
                            that._error('上传失败' + data);
                            that._trigger('fileuploaderror.fileuploader', { filename: file.name, filesize: file.size, message: data });
                        }

                    }).fail(ajaxFailCall);
                } else
                {
                    sendBlobt2Server(url, {
                        opration: 'upload',
                        filename: filename,
                        filestep: file.size - offset,
                        offset: offset,
                        filesize: file.size,
                        isoverwrite: isOverwrite,
                        blob: file.slice(offset, file.size)
                    }).then(function (data)
                    {
                        if (data === '')
                        {
                            that._doShowResult(filecontent, '100%');
                            that._trigger('fileuploadend.fileuploader', { filename: filename, filesize: file.size });
                            that._trigger('change', ['upload', filecontent]);
                            that.countuploaded++;
                            that.filecount++;
                            if (that.count2upload === that.countuploaded)
                            {
                                that._trigger('alluploadend.fileuploader', [that.files]);
                            }
                        } else
                        {
                            that._error('上传失败' + data);
                            that._trigger('fileuploaderror.fileuploader', { filename: filename, filesize: file.size, message: data });
                        }

                    }).fail(ajaxFailCall);
                }
            })(0, that.options.step);

        },

        _isCanUpload: function (content)
        {
            var isCanupload = true;

            var filename = content.filename;
            var that = this;
            $.each(this.files, function (i, a)
            {
                if (a.filename === filename)
                {
                    isCanupload = false;
                    that._warn('FileUploader: [' + filename + '] 已经上传过，不允许重复上传！');
                    return false;
                }
            });

            var isExtNameRight = false;

            $.each(this.options.extnames.split(';').filter(function (a)//过滤，split会保留;前后的空白
            {
                return !!a;
            }), function (i, a)
            {
                if (filename.endsWith(a))
                {
                    isExtNameRight = true;
                    return false;
                }
            });
            if (!isExtNameRight)
            {
                isCanupload = false;
                that._warn('FileUploader: [' + filename + '] 文件类型不正确！');
            }
            if (this.options.fileuploadsizemax > 0 && content.filesize / 1024 > this.options.fileuploadsizemax)
            {
                isCanupload = false;
                that._warn('FileUploader: [' + filename + '超过文件大小限制]!')
            }
            return isCanupload;
        },

        _setDisable: function (isDisable)
        {
            this.options.disable = isDisable;
            var $tr = this.$container.find('.div-table>table tr[data-filecode]');

            isDisable = isDisable || this.options.disable;
            if (isDisable)
            {
                this.$container.find('input[type=button]').addClass('hidden');
                $tr.find('a[name=a_delete]').addClass('hidden');
            } else
            {
                this.$container.find('input[type=button]').removeClass('hidden');
                $tr.find('a[name=a_delete]').removeClass('hidden');
            }
        },

        getfilecount: function ()
        {
            return this.filecount;
        },
        getoptions: function ()
        {
            return this.options;
        },
        getcontent: function ()
        {
            return this.files;
        },

        loadcontent: function (files)
        {
            if (!$.isArray(files))
            {
                files = [files];
            }
            var _files = this.files;
            $.each(files, function (index, file)
            {
                if ('string' === typeof file)
                {
                    _files.push(new FileContent(file, -1, initFileCode(), file));
                } else
                {
                    _files.push(new FileContent(file.filename, file.filesize, initFileCode(), file));
                }
            });
            this.files = (_files);
            this._initShowResult();
        },

        disable: function (disable)
        {
            if (disable === undefined)
            {
                return this.options.disable;
            }
            return this._setDisable(disable);
        },
        clear: function ()
        {
            this.filecount = 0;
            this.files = [];
            this.$container.find('.div-table>table').empty();
        },
        distroy: function ()
        {
            //this.$el.parent().remove();
            this.$el.unwrap().removeClass('hidden');
            this.$container.remove();
            this.$el.removeData('bootstrap.fileuploader');
        }
    };

    $.fn.fileuploader = function (fname)
    {
        var value;
        var args = slice.call(arguments, 1);
        this.each(function (i, a)
        {
            var $this = $(this);
            var uploader = $this.data('bootstrap.fileuploader');
            if (!uploader)
            {

                uploader = new FileUploader($this, fname);
                $(this).data('bootstrap.fileuploader', uploader);

            } else if ('string' === typeof (fname))
            {
                //这个方式是从bootstraptable中学来的，但是我觉得这里应该是这样，否则会取到最后一个的值，记得原来看jquery插件开发的教程时人家写的，赋值的时候全部赋值，取值的时候取第一个
                value = value || uploader[fname].apply(uploader, args);//先不考虑如何调用方法
            }
        });
        // return value || this;//这里有可能value的值是false
        return value === undefined ? this : value;
    }

    $.fn.fileuploader.setDefaultOptions = function (option)
    {
        FileUploader.DEFAULTOPTS = $.extend({}, FileUploader.DEFAULTOPTS, option);
    }
})(jQuery);