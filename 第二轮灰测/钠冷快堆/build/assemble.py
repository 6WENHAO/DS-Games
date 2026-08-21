import re, pathlib, sys
B = pathlib.Path(__file__).parent
out = B.parent / "钠冷快堆CFR-1500概念设计.html"
css = (B/"css/main.css").read_text(encoding="utf8")
html = (B/"shell_a.html").read_text(encoding="utf8") + "\n" + \
       (B/"shell_b.html").read_text(encoding="utf8") + "\n" + \
       (B/"shell_c.html").read_text(encoding="utf8")
html = html.replace("/*@@CSS@@*/", css)
def repl(m):
    p = B/"js"/m.group(1)
    src = p.read_text(encoding="utf8")
    if "</script" in src.lower():
        sys.exit("ERROR: </script in " + m.group(1))
    return src
html = re.sub(r"/\*@@JS:([\w\-.]+)@@\*/", repl, html)
assert "@@" not in html, "未替换的占位符: " + html[html.index("@@")-80:html.index("@@")+80]
out.write_text(html, encoding="utf8")
print("wrote", out, len(html), "chars,", html.count("\n")+1, "lines")
