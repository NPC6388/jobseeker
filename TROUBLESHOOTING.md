# JobSeeker Web Interface Troubleshooting

## 🔍 "Site Can't Be Reached" Error Solutions

### **Quick Fixes (Try These First):**

1. **Wait and Refresh**
   - The server takes 5-10 seconds to fully start
   - Wait for the "Client connected" message in the console
   - Try refreshing the browser (F5 or Ctrl+R)

2. **Try Different URLs**
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - `http://0.0.0.0:3000`

3. **Clear Browser Cache**
   - Press Ctrl+Shift+Delete
   - Clear browsing data
   - Try again

### **Advanced Solutions:**

4. **Check Windows Firewall**
   ```
   - Open Windows Security
   - Go to Firewall & Network Protection
   - Allow an app through firewall
   - Add Node.js if not listed
   ```

5. **Try Different Browser**
   - Chrome: `chrome http://localhost:3000`
   - Firefox: `firefox http://localhost:3000`
   - Edge: `msedge http://localhost:3000`

6. **Check if Port is Available**
   ```bat
   netstat -ano | findstr :3000
   ```
   If you see results, the server is running.

7. **Restart with Different Port**
   - Edit `.env` file
   - Add line: `PORT=3001`
   - Try `http://localhost:3001`

### **Manual Browser Commands:**

**Chrome:**
```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000
```

**Firefox:**
```bat
"C:\Program Files\Mozilla Firefox\firefox.exe" http://localhost:3000
```

**Edge:**
```bat
msedge http://localhost:3000
```

### **Alternative Access Methods:**

1. **Use the batch file with auto-open:**
   ```bat
   JobSeeker.bat
   ```

2. **Manual command:**
   ```bat
   cd C:\Users\matth\Desktop\AI\jobseeker
   npm run web
   ```

3. **PowerShell launcher:**
   ```powershell
   .\StartJobSeeker.ps1
   ```

### **Check Server Status:**

Run this in command prompt:
```bat
curl http://localhost:3000
```

If you get HTML content, the server is working.

### **Last Resort - Use Different Interface:**

If web interface won't work, use the command line:
```bat
npm start
```

This runs the original command-line version.

---

## 🆘 Still Having Issues?

1. **Check the console window** for error messages
2. **Try restarting your computer**
3. **Disable antivirus temporarily** (some block localhost)
4. **Run as Administrator** (right-click batch file → "Run as administrator")

## 📧 Error Reporting

If you're still having issues, note:
- Your browser name and version
- Any error messages in the console
- Windows version
- Antivirus software