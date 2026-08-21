@echo off
rem Chinese-named shortcut. Contents stay pure ASCII on purpose:
rem cmd.exe parses .bat bytes with the OEM codepage, so UTF-8 Chinese inside a
rem .bat breaks the parser. The filename itself is fine.
call "%~dp0qianxi.bat" %*
