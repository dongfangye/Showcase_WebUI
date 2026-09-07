#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
物品展示前端 - 启动脚本
使用 Python 内置 HTTP 服务器，在浏览器中打开 WebUI/index.html
"""

import os
import sys
import webbrowser
import http.server
import socketserver
import threading
import time
from pathlib import Path


def get_available_port(start_port=8000, max_attempts=10):
    """获取一个可用端口"""
    for port in range(start_port, start_port + max_attempts):
        try:
            with socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler) as test_server:
                test_server.server_close()
                return port
        except OSError:
            continue
    raise RuntimeError("无法找到可用端口")


def open_browser(url, delay=1.5):
    """延迟打开浏览器"""
    time.sleep(delay)
    webbrowser.open(url)


def main():
    # 切换到 WebUI 目录
    script_dir = Path(__file__).parent.absolute()
    webui_dir = script_dir / "WebUI"

    if not webui_dir.exists():
        print("❌ 错误: 找不到 WebUI 文件夹")
        print(f"   请确保 {webui_dir} 存在，且包含 index.html")
        sys.exit(1)

    os.chdir(webui_dir)

    # 检查 index.html 是否存在
    index_path = webui_dir / "index.html"
    if not index_path.exists():
        print("❌ 错误: 找不到 index.html 文件")
        print(f"   请确保 {index_path} 存在")
        sys.exit(1)

    # 获取可用端口
    port = get_available_port()
    url = f"http://localhost:{port}"

    # 启动 HTTP 服务器
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print("=" * 50)
        print("📦 物品展示平台")
        print("=" * 50)
        print(f"✅ 服务器已启动: {url}")
        print(f"📁 目录: {webui_dir}")
        print("⏹️  按 Ctrl+C 停止服务器")
        print("=" * 50)

        # 自动打开浏览器
        threading.Thread(target=open_browser, args=(url,), daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 服务器已停止")
            httpd.shutdown()


if __name__ == "__main__":
    main()