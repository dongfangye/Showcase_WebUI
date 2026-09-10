#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import threading

from pathlib import Path


# 防止多个线程同时写 JSON
_JSON_WRITE_LOCK = threading.Lock()


def update_json_file(
    project_root,
    relative_path,
    key_path,
    value,
):
    """
    修改 JSON 文件指定位置的数据。

    参数：
        project_root:
            项目根目录

        relative_path:
            JSON 文件相对于项目根目录的位置
            例如：
            Warehouse/des.json

        key_path:
            JSON 路径，例如：
            ["categories", 0, "name"]

        value:
            要写入的新值

    返回：
        修改后的完整 JSON 数据
    """

    project_root = Path(project_root).resolve()

    json_path = (
        project_root / relative_path
    ).resolve()

    # ========================================
    # 安全检查：禁止跑出项目目录
    # ========================================

    try:
        json_path.relative_to(project_root)

    except ValueError:
        raise ValueError(
            "禁止修改项目目录之外的文件"
        )

    # ========================================
    # 只允许 JSON
    # ========================================

    if json_path.suffix.lower() != ".json":
        raise ValueError(
            "只允许修改 JSON 文件"
        )

    # ========================================
    # 文件必须存在
    # ========================================

    if not json_path.is_file():
        raise FileNotFoundError(
            f"JSON 文件不存在：{relative_path}"
        )

    if not isinstance(key_path, list):
        raise ValueError(
            "key_path 必须是 list"
        )

    # ========================================
    # 开始修改
    # ========================================

    with _JSON_WRITE_LOCK:

        with open(
            json_path,
            "r",
            encoding="utf-8",
        ) as f:

            data = json.load(f)

        # 空路径表示替换整个 JSON
        if len(key_path) == 0:

            data = value

        else:

            target = data

            # 定位到目标的父节点
            for key in key_path[:-1]:

                if isinstance(target, dict):

                    if key not in target:
                        raise KeyError(
                            f"字段不存在：{key}"
                        )

                    target = target[key]

                elif isinstance(target, list):

                    if not isinstance(key, int):
                        raise ValueError(
                            f"数组索引必须是整数：{key}"
                        )

                    if (
                        key < 0
                        or key >= len(target)
                    ):
                        raise IndexError(
                            f"数组索引越界：{key}"
                        )

                    target = target[key]

                else:

                    raise ValueError(
                        f"无法继续访问路径：{key_path}"
                    )

            final_key = key_path[-1]

            # ====================================
            # 修改最终值
            # ====================================

            if isinstance(target, dict):

                target[final_key] = value

            elif isinstance(target, list):

                if not isinstance(final_key, int):
                    raise ValueError(
                        "数组索引必须是整数"
                    )

                if (
                    final_key < 0
                    or final_key >= len(target)
                ):
                    raise IndexError(
                        f"数组索引越界：{final_key}"
                    )

                target[final_key] = value

            else:

                raise ValueError(
                    "目标位置无法修改"
                )

        # ========================================
        # 原子保存
        # ========================================

        temp_path = json_path.with_suffix(
            json_path.suffix + ".tmp"
        )

        with open(
            temp_path,
            "w",
            encoding="utf-8",
        ) as f:

            json.dump(
                data,
                f,
                ensure_ascii=False,
                indent=2,
            )

            f.flush()
            os.fsync(f.fileno())

        os.replace(
            temp_path,
            json_path,
        )

    return data

def update_object_by_id(
    project_root,
    relative_path,
    list_path,
    object_id,
    updates,
    id_field="id",
    children_field="children",
):
    """
    根据 ID 递归查找对象并修改。

    例如：
        update_object_by_id(
            project_root=project_root,
            relative_path="Warehouse/des.json",
            list_path=["categories"],
            object_id="cat_001",
            updates={
                "name": "数码产品"
            }
        )
    """

    project_root = Path(project_root).resolve()

    json_path = (
        project_root / relative_path
    ).resolve()

    try:
        json_path.relative_to(project_root)

    except ValueError:
        raise ValueError(
            "禁止修改项目目录之外的文件"
        )

    if json_path.suffix.lower() != ".json":
        raise ValueError(
            "只允许修改 JSON 文件"
        )

    if not json_path.is_file():
        raise FileNotFoundError(
            f"JSON 文件不存在：{relative_path}"
        )

    if not isinstance(updates, dict):
        raise ValueError(
            "updates 必须是字典"
        )

    with _JSON_WRITE_LOCK:

        with open(
            json_path,
            "r",
            encoding="utf-8",
        ) as f:

            data = json.load(f)

        # ========================================
        # 找到列表
        # ========================================

        target = data

        for key in list_path:

            target = target[key]

        if not isinstance(target, list):
            raise ValueError(
                "list_path 指向的不是数组"
            )

        # ========================================
        # 递归查找
        # ========================================

        def find_object(nodes):

            for node in nodes:

                if (
                    isinstance(node, dict)
                    and node.get(id_field) == object_id
                ):

                    return node

                children = node.get(
                    children_field,
                    [],
                )

                if isinstance(children, list):

                    result = find_object(
                        children
                    )

                    if result is not None:
                        return result

            return None

        obj = find_object(target)

        if obj is None:
            raise KeyError(
                f"没有找到 ID：{object_id}"
            )

        # ========================================
        # 修改字段
        # ========================================

        obj.update(updates)

        # ========================================
        # 保存
        # ========================================

        temp_path = json_path.with_suffix(
            json_path.suffix + ".tmp"
        )

        with open(
            temp_path,
            "w",
            encoding="utf-8",
        ) as f:

            json.dump(
                data,
                f,
                ensure_ascii=False,
                indent=2,
            )

            f.flush()
            os.fsync(f.fileno())

        os.replace(
            temp_path,
            json_path,
        )

    return data