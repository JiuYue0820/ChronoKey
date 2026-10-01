@echo off
rem Build ChronoKeySetup.exe with the .NET Framework csc that ships with Windows (no SDK needed)
setlocal
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
cd /d "%~dp0"
"%CSC%" /nologo /target:winexe /optimize+ /platform:anycpu /win32icon:..\build\icon.ico /win32manifest:app.manifest ^
  /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ^
  /out:ChronoKeySetup.exe ChronoKeySetup.cs
