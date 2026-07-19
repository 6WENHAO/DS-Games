import http.server,functools,sys

PORT=int(sys.argv[1]) if len(sys.argv)>1 else 8090

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control","no-store, no-cache, must-revalidate")
        self.send_header("Pragma","no-cache")
        self.send_header("Expires","0")
        super().end_headers()
    def log_message(self,*a):
        pass

if __name__=="__main__":
    import os
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    http.server.ThreadingHTTPServer(("",PORT),H).serve_forever()
