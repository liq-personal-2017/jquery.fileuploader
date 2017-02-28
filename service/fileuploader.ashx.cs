using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.IO;
namespace fileupload.service
{
    /// <summary>
    /// fileuploader 的摘要说明
    /// </summary>
    public class fileuploader : IHttpHandler
    {
        const string filerootpath = "d:/fileuploader/";//这个文件位置可以做成配置，通过读取得到，这里作为实例，直接写死。
        private bool isStringNull(string str)
        {
            if (str == "" || str == null)
            {
                return true;
            }
            return false;
        }

        private string GetFileRootPath(string fileid)
        {
            if (isStringNull(fileid))
            {
                return filerootpath;
            }
            var rootpath = filerootpath + fileid + "/";
            if (!Directory.Exists(rootpath))
            {
                Directory.CreateDirectory(rootpath);
            }
            return rootpath;
        }

        public void ProcessRequest(HttpContext context)
        {
            //string filename = "";
            ////FileInfo fi = new FileInfo("");

            //var request = context.Request;
            //var response = context.Response;
            //byte[] bytes = new byte[request.InputStream.Length];
            //request.InputStream.Read(bytes, 0, bytes.Length);
            //response.Write(bytes.Length);
            var result = "";
            var opration = context.Request.Params["opration"];
            var req = context.Request;
            var res = context.Response;

            switch (opration)
            {
                case "upload":
                    {
                        var fileid = req.Params["fileid"];
                        var filename = req.Params["filename"];
                        var filesize = int.Parse(req.Params["filesize"]);
                        var filestep = int.Parse(req.Params["filestep"]);
                        var isoverwrite = req.Params["isoverwrite"];
                        var offset = int.Parse(req.Params["offset"]);
                        FileStream fs = null;
                        string filepath = GetFileRootPath(fileid) + filename;
                        if (offset == 0)
                        {
                            if (isoverwrite != "true" && File.Exists(filepath))
                            {
                                throw new Exception("文件已存在");
                            }
                        }
                        try
                        {
                            fs = File.Open(filepath, FileMode.OpenOrCreate, FileAccess.Write, FileShare.Write);
                            //这里并没有进行循环读取，是直接按照前台给出的大小进行读取的，所以理论上不需要循环（如果考虑后端的内存消耗问题，这里可以改成由后端自己控制，循环读取）
                            byte[] bytes = new byte[filestep];
                            int length = req.InputStream.Read(bytes, 0, filestep);
                            //fs.Seek(offset, SeekOrigin.Begin);
                            fs.Position = offset;
                            fs.Write(bytes, 0, length);
                        }
                        catch (Exception)
                        {

                            throw;
                        }
                        finally
                        {
                            fs?.Flush();
                            fs?.Dispose();
                            fs?.Close();
                        }

                        res.Output.Write(result);
                        res.Output.Flush();
                    }
                    break;
                case "download":
                    {
                        var fileid = req.Params["fileid"];
                        var filename = req.Params["filename"];
                        var filepath = GetFileRootPath(fileid) + filename;
                        if (File.Exists(filepath))
                        {
                            //如果附件系统不管理超大文件，可以将下面这一段改成res.writefile，这个方法会缓存文件，优化性能。。。
                            byte[] buffer = new Byte[10000];

                            // Length of the file:
                            int length;
                            Stream iStream = null;
                            try
                            {

                                iStream = new System.IO.FileStream(filepath, FileMode.Open, FileAccess.Read, FileShare.Read);

                                var dataToRead = iStream.Length;

                                res.Clear();
                                res.ClearHeaders();
                                res.ClearContent();
                                res.ContentType = "application/octet-stream"; // Set the file type
                                res.AddHeader("Content-Length", dataToRead.ToString());
                                res.AddHeader("Content-Disposition", "attachment; filename=" + HttpUtility.UrlEncode(filename, System.Text.Encoding.UTF8));

                                while (dataToRead > 0)
                                {
                                    // Verify that the client is connected.
                                    if (res.IsClientConnected)
                                    {
                                        // Read the data in buffer.
                                        length = iStream.Read(buffer, 0, 10000);

                                        // Write the data to the current output stream.
                                        res.OutputStream.Write(buffer, 0, length);

                                        // Flush the data to the HTML output.
                                        res.Flush();

                                        buffer = new Byte[10000];
                                        dataToRead = dataToRead - length;
                                    }
                                    else
                                    {
                                        // Prevent infinite loop if user disconnects
                                        dataToRead = -1;
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                // Trap the error, if any.
                                res.Write("Error : " + ex.Message);
                            }
                            finally
                            {
                                if (iStream != null)
                                {
                                    //Close the file.
                                    iStream.Close();
                                }

                                res.End();
                            }
                        }
                        else
                        {
                            res.StatusCode = 404;
                            //res.TransmitFile
                            //res.WriteFile
                            res.Write("找不到文件：" + filename);
                        }
                    }
                    break;
                case "delete":
                    {
                        var fileid = req.Params["fileid"];
                        var filename = req.Params["filename"];
                        var filepath = GetFileRootPath(fileid) + filename;
                        if (File.Exists(filepath))
                        {
                            File.Delete(filepath);
                        }
                        res.Output.Write(result);
                        res.Output.Flush();
                    }
                    break;
                default:
                    res.Write("Error : unknown opration [" + opration + "]");
                    break;
            }


        }

        public bool IsReusable
        {
            get
            {
                return true;
            }
        }
    }
}