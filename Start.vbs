Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "pocketbase.exe serve", 0, False
WshShell.Run "cmd /c start http://127.0.0.1:8090", 0, False