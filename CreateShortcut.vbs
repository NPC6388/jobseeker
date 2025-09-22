Option Explicit

Dim objShell, objFSO, desktopPath, shortcutPath, currentDir
Dim objShortcut, batFilePath, iconPath

' Create Shell and FileSystem objects
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get current directory (where the script is located)
currentDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Get desktop path
desktopPath = objShell.SpecialFolders("Desktop")

' Define paths
shortcutPath = desktopPath & "\JobSeeker.lnk"
batFilePath = currentDir & "\JobSeeker.bat"

' Create the shortcut
Set objShortcut = objShell.CreateShortcut(shortcutPath)
objShortcut.TargetPath = batFilePath
objShortcut.WorkingDirectory = currentDir
objShortcut.Description = "JobSeeker - Automated Job Search Tool"
objShortcut.WindowStyle = 1

' Try to set a custom icon (use a system icon if custom not available)
iconPath = "C:\Windows\System32\shell32.dll,25"  ' Search icon
objShortcut.IconLocation = iconPath

' Save the shortcut
objShortcut.Save

' Show success message
MsgBox "✅ Desktop shortcut created successfully!" & vbCrLf & vbCrLf & _
       "📁 Location: " & shortcutPath & vbCrLf & _
       "🔍 Double-click the 'JobSeeker' icon on your desktop to start the application.", _
       vbInformation, "JobSeeker Setup Complete"

' Clean up
Set objShortcut = Nothing
Set objShell = Nothing
Set objFSO = Nothing