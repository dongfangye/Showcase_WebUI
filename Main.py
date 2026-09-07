#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import webbrowser
import http.server
import socketserver
import threading
import time
from pathlib import Path

def get_available_port(start_port=8000, max_attempts=10):
    for port in range(start_port, start_port + max_attempts):
        try:
            with socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler) as test_server:
                test_server.server_close()
                return port
        except OSError:
            continue
    raise RuntimeError("无法找到可用端口")

def open_browser(url, delay=1.5):
    time.sleep(delay)
    webbrowser.open(url)

def main():
    script_dir = Path(__file__).parent.absolute()
    
    # 检查 WebUI 文件夹是否存在
    webui_dir = script_dir / "WebUI"
    if not webui_dir.exists():
        print("❌ 错误: 找不到 WebUI 文件夹")
        sys.exit(1)

    # 检查 index.html 是否存在
    index_path = webui_dir / "index.html"
    if not index_path.exists():
        print("❌ 错误: 找不到 index.html 文件")
        sys.exit(1)

    # ⚠️ 重要：SimpleHTTPRequestHandler 以进程的当前工作目录作为服务器根目录，
    # 而非脚本所在目录。必须显式切换到项目根目录，否则从其他位置启动时
    # /WebUI/index.html 会返回 404 导致页面加载失败。
    os.chdir(script_dir)

    port = get_available_port()
    # ✅ URL 指向 WebUI 子目录下的 index.html
    url = f"http://localhost:{port}/WebUI/index.html"

    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        threading.Thread(target=open_browser, args=(url,), daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 服务器已停止")
            httpd.shutdown()

if __name__ == "__main__":
    main()