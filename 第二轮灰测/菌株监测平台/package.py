# -*- coding: utf-8 -*-
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
"""StrainLab 打包脚本：生成干净分发包 zip（排除缓存与运行数据目录）。"""
import zipfile, os

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "StrainLab-菌株监测平台-分发包.zip")
KEEP = {"app.py", "epi_engine.py", "frontend.html", "README.md",
        "启动StrainLab.bat", "打包分发包.bat", "package.py"}
SKIP_DIRS = {"__pycache__", "data", "imported", "manuals"}

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    n = 0
    for name in sorted(os.listdir(ROOT)):
        p = os.path.join(ROOT, name)
        if name in KEEP and os.path.isfile(p):
            z.write(p, os.path.join("菌株监测平台", name)); n += 1
        elif os.path.isdir(p) and name not in SKIP_DIRS:
            for dp, _, fs in os.walk(p):
                for f in fs:
                    fp = os.path.join(dp, f)
                    z.write(fp, os.path.join("菌株监测平台", os.path.relpath(fp, ROOT))); n += 1
print("已打包 %d 个文件 -> %s" % (n, OUT))