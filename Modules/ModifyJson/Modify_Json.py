#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import threading

from pathlib import Path


# 防止多个线程同时写 JSON
_JSON_WRITE_LOCK = threading.Lock()

def _load_json(json_path):
    """读取 JSON 文件。"""

    with open(
        json_path,
        "r",
        encoding="utf-8",
    ) as f:

        return json.load(f)


def _save_json(json_path, data):
    """
    原子方式保存 JSON。
    """

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
            indent=4,
        )

        f.flush()
        os.fsync(f.fileno())

    os.replace(
        temp_path,
        json_path,
    )


def reorder_categories(
    project_root,
    relative_path,
    ordered_ids,
    parent_id=None,
):
    """
    调整侧边栏分类顺序。

    参数
    ----------
    project_root:
        项目根目录。

    relative_path:
        JSON 文件路径，例如：
        Warehouse/des.json

    ordered_ids:
        新的 ID 顺序。

        一级分类：
        [
            "furniture",
            "clothing",
            "electronics"
        ]

        二级分类：
        [
            "outerwear",
            "tops",
            "bottoms"
        ]

    parent_id:
        None：
            表示调整一级 categories

        "clothing"：
            表示调整 clothing 下的
            sub_categories

    返回
    ----------
    修改后的完整 JSON
    """

    project_root = Path(
        project_root
    ).resolve()

    json_path = (
        project_root / relative_path
    ).resolve()

    # ========================================
    # 安全检查
    # ========================================

    try:
        json_path.relative_to(
            project_root
        )

    except ValueError:
        raise ValueError(
            "禁止修改项目目录之外的文件"
        )

    if (
        json_path.suffix.lower()
        != ".json"
    ):
        raise ValueError(
            "只允许修改 JSON 文件"
        )

    if not json_path.is_file():
        raise FileNotFoundError(
            f"JSON 文件不存在：{relative_path}"
        )

    if not isinstance(
        ordered_ids,
        list,
    ):
        raise ValueError(
            "ordered_ids 必须是数组"
        )

    # 防止重复 ID
    if (
        len(ordered_ids)
        != len(set(ordered_ids))
    ):
        raise ValueError(
            "ordered_ids 中存在重复 ID"
        )

    # ========================================
    # 加锁
    # ========================================

    with _JSON_WRITE_LOCK:

        data = _load_json(
            json_path
        )

        categories = data.get(
            "categories",
            []
        )

        # ====================================
        # 一级分类排序
        # ====================================

        if parent_id is None:

            _reorder_list(
                categories,
                ordered_ids,
            )

        # ====================================
        # 二级分类排序
        # ====================================

        else:

            parent = _find_category(
                categories,
                parent_id,
            )

            if parent is None:
                raise KeyError(
                    f"找不到父分类：{parent_id}"
                )

            sub_categories = parent.get(
                "sub_categories",
                []
            )

            _reorder_list(
                sub_categories,
                ordered_ids,
            )

        # ====================================
        # 保存
        # ====================================

        _save_json(
            json_path,
            data,
        )

    return data


def _find_category(
    categories,
    category_id,
):
    """
    根据 ID 查找分类。

    同时支持以后继续增加更深层级。
    """

    for category in categories:

        if (
            category.get("id")
            == category_id
        ):
            return category

        children = category.get(
            "sub_categories",
            []
        )

        if children:

            result = _find_category(
                children,
                category_id,
            )

            if result is not None:
                return result

    return None


def _reorder_list(
    items,
    ordered_ids,
):
    """
    根据 ID 数组重新排列列表。
    """

    if not isinstance(
        items,
        list,
    ):
        raise ValueError(
            "目标不是数组"
        )

    # 当前 JSON 中所有 ID
    current_ids = [
        item.get("id")
        for item in items
    ]

    # ========================================
    # 检查前端提交的数据是否完整
    # ========================================

    if set(current_ids) != set(
        ordered_ids
    ):
        raise ValueError(
            "排序 ID 与 JSON 中现有分类不一致"
        )

    # ID -> object
    item_map = {
        item["id"]: item
        for item in items
    }

    # 按前端提供的新顺序重建
    new_items = [
        item_map[item_id]
        for item_id in ordered_ids
    ]

    # 原地修改
    items[:] = new_items


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