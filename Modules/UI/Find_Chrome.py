#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import shutil
from pathlib import Path


def find_chrome():
    """
    查找 Chrome / Chromium / Edge 可执行文件。

    Returns:
        str | None:
            找到时返回浏览器可执行文件路径，
            未找到时返回 None。
    """

    candidates = []

    # Windows
    if sys.platform.startswith("win"):
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        program_files = os.environ.get("PROGRAMFILES", "")
        program_files_x86 = os.environ.get("PROGRAMFILES(X86)", "")

        candidates.extend([
            # Google Chrome
            Path(local_app_data) / "Google/Chrome/Application/chrome.exe",
            Path(program_files) / "Google/Chrome/Application/chrome.exe",
            Path(program_files_x86) / "Google/Chrome/Application/chrome.exe",

            # Microsoft Edge
            Path(program_files) / "Microsoft/Edge/Application/msedge.exe",
            Path(program_files_x86) / "Microsoft/Edge/Application/msedge.exe",
        ])

    # macOS
    elif sys.platform == "darwin":
        candidates.extend([
            # Google Chrome
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            Path.home() / "Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

            # Microsoft Edge
            Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
            Path.home() / "Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ])

    # Linux
    else:
        command_names = [
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
            "microsoft-edge",
            "microsoft-edge-stable",
        ]

        for name in command_names:
            path = shutil.which(name)
            if path:
                return path

    # 检查 Windows / macOS 固定路径
    for path in candidates:
        if path and path.exists():
            return str(path)

    # 最后再尝试 PATH
    command_names = [
        "chrome",
        "chrome.exe",
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "msedge",
        "msedge.exe",
        "microsoft-edge",
        "microsoft-edge-stable",
    ]

    for name in command_names:
        path = shutil.which(name)
        if path:
            return path

    return None