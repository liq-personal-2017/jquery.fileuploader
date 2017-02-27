## jquery.fileuploader


* 说明：

    1. 关于传输：这个程序本身并不考虑传输的问题，保证传输的正确性这件事应该由浏览器来做，程序认为每次传输都是正确的，如果失败了，则直接导致这个文件的传输失败
    2. 关于断点续传：因为javascript的fileAPI本身很弱，并且不具备直接访问物理文件的功能，也无法访问文件的具体路径，所以纯javascript是无法实现断点传输的（另，曾经其实想过把当前的file对象直接存储到数据库中，下回从数据库取出来以进行“断点传输”，艾玛，我都存到数据库了，为啥还要拿出来重新上传，【笑】）
    3. 关于事件：所有的事件都注册在元素本身上面，这样可以由编程人员直接在元素上注册事件，比如change事件，控件中就没有提供默认的初始化，但是有触发
    4. 关于安全：本程序上传的参数都是直接添加在url上的，不要考虑安全的问题，如果需要考虑安全的问题，请使用HTTPS
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
* 下载部分：理论上来说这个应该是只处理上传的功能，所以下载的功能很弱，前端将处理成一个简单的\<a>，由后端处理响应头以使浏览器发起下载--ok

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
            
            , change 发生变化，即删除之后和所有上传结束之后--ok
            , beforeallupload 上传之前，因为以前有过一个很诡异的要求:
                            我们做的gis，有一组shp文件，在操作中是一个个体，但是作为文件系统来看，却又是一组（六个）文件，所以会在上传之前校验一下文件类型，文件名，所以添加一个事件
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

            单个文件大小限制：fileUploadSizeMax: 1000000, KB为单位 ok

        }
* 方法

        {
            
            getoptions : 获取当前控件的配置 ok
            
            getcontent : 获取当前控件的内容【数组：[{FileContent}]】 ok

            getfilecount : 获取当前控件上传的文件数量 ok

            loadcontent : 加载数据
            
            disable : 设置/获取 可用状态 ok
        }