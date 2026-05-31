const fs = require('fs');
const path = require('path');

function searchRPC(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchRPC(fullPath);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.jsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = /\.rpc\s*\(\s*['"`](.*?)['"`]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        console.log(`Found RPC call "${match[1]}" in ${fullPath}`);
      }
    }
  }
}

searchRPC('C:\\Users\\edarj\\.gemini\\antigravity\\scratch\\grade-management-system\\src');
