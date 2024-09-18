start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --new-tab 127.0.0.1:9222/json/version/
start cmd /k "npm run start &"
