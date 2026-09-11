#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import time
import subprocess
import threading
import http.server
import socketserver

from pathlib import Path
from functools import partial
import json
import uuid

from Modules.UI.Find_Chrome import find_chrome
from Modules.ModifyJson import (update_json_file, update_object_by_id, reorder_categories, add_category)

def open_browser(url, delay=1.0):
    """打开浏览器窗口。不监控其退出（Chrome 多进程/单例机制会导致误判）。"""
    time.sleep(delay)

    browser_path = find_chrome()

    if not browser_path:
        print("❌ 未找到 Chrome / Chromium / Edge")
        print(f"请手动打开：{url}")
        return

    print(f"🌐 浏览器：{browser_path}")

    try:
        subprocess.Popen(
            [
                browser_path,
                f"--app={url}",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    except Exception as e:
        print(f"❌ 启动浏览器失败：{e}")
        print(f"请手动打开：{url}")
class AppRequestHandler(http.server.SimpleHTTPRequestHandler):

    project_root = None

    def send_json(self, status, data):
        body = json.dumps(
            data,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )
        self.send_header(
            "Content-Length",
            str(len(body)),
        )
        self.end_headers()

        self.wfile.write(body)

    def read_json_body(self):
        length = int(
            self.headers.get(
                "Content-Length",
                0,
            )
        )

        raw = self.rfile.read(length)

        if not raw:
            return {}

        return json.loads(
            raw.decode("utf-8")
        )

    def do_POST(self):
        try:
            body = self.read_json_body()

            # ==============================
            # 修改分类名称
            # ==============================
            if self.path == "/api/category/rename":
                category_id = str(
                    body.get("id", "")
                ).strip()

                new_name = str(
                    body.get("name", "")
                ).strip()

                if not category_id:
                    raise ValueError(
                        "缺少分类 id"
                    )

                if not new_name:
                    raise ValueError(
                        "分类名称不能为空"
                    )

                data = update_object_by_id(
                    project_root=self.project_root,
                    relative_path="Warehouse/des.json",
                    list_path=["categories"],
                    object_id=category_id,
                    updates={
                        "name": new_name,
                    },

                    # 非常重要
                    children_field="sub_categories",
                )

                self.send_json(
                    200,
                    {
                        "success": True,
                        "data": data,
                    },
                )

                return

            # ==============================
            # 新增分类
            # ==============================
            if self.path == "/api/category/add":
                name = str(
                    body.get("name", "")
                ).strip()

                parent_id = body.get(
                    "parent_id"
                )

                if not name:
                    raise ValueError(
                        "分类名称不能为空"
                    )

                prefix = (
                    "sub"
                    if parent_id
                    else "cat"
                )

                category_id = (
                    f"{prefix}_"
                    f"{uuid.uuid4().hex[:10]}"
                )

                data = add_category(
                    project_root=self.project_root,
                    relative_path="Warehouse/des.json",
                    category={
                        "id": category_id,
                        "name": name,
                        "icon": "",
                        "sub_categories": [],
                    },
                    parent_id=parent_id,
                )

                self.send_json(
                    200,
                    {
                        "success": True,
                        "id": category_id,
                        "data": data,
                    },
                )

                return

            self.send_json(
                404,
                {
                    "success": False,
                    "message": "API 不存在",
                },
            )

        except KeyError as e:
            self.send_json(
                404,
                {
                    "success": False,
                    "message": str(e),
                },
            )

        except (
            ValueError,
            json.JSONDecodeError,
        ) as e:
            self.send_json(
                400,
                {
                    "success": False,
                    "message": str(e),
                },
            )

        except Exception as e:
            print("API 错误:", e)

            self.send_json(
                500,
                {
                    "success": False,
                    "message": str(e),
                },
            )

class LocalHTTPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main():
    # Windows 控制台默认 GBK，无法编码 emoji 会抛 UnicodeEncodeError 导致异常退出，
    # 强制 stdout/stderr 使用 UTF-8 保证日志稳定输出。
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    script_dir = Path(__file__).resolve().parent
    webui_dir = script_dir / "WebUI"

    # 检查 WebUI
    if not webui_dir.is_dir():
        print("❌ 错误：找不到 WebUI 文件夹")
        sys.exit(1)

    # 检查 index.html
    index_path = webui_dir / "index.html"

    if not index_path.is_file():
        print("❌ 错误：找不到 WebUI/index.html")
        sys.exit(1)

    # ⚠️ 服务器根目录必须设为项目根目录（而非 WebUI）：
    # index.html 用相对路径引用同目录的 style.css/script.js，
    # script.js 又通过 ../Warehouse/des.json 加载数据。
    # 若把根目录设为 WebUI，Warehouse 位于其外将无法访问，
    # 数据请求会 404，导致页面内容为空。
    AppRequestHandler.project_root = script_dir

    handler = partial(
        AppRequestHandler,
        directory=str(script_dir),
    )

    # 端口设为 0，让系统自动选择可用端口
    with LocalHTTPServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        url = f"http://127.0.0.1:{port}/WebUI/index.html"

        print(f"🚀 WebUI 已启动：{url}")
        print("⌨️  按 Ctrl+C 停止服务器")

        threading.Thread(
            target=open_browser,
            args=(url,),
            daemon=True,
        ).start()

        try:
            httpd.serve_forever(poll_interval=0.2)

        except KeyboardInterrupt:
            print("\n🛑 正在停止服务器...")
            httpd.shutdown()

    print("✅ 服务器已停止")


if __name__ == "__main__":
    main()