const fs = require('fs');
const file = '/home/nodiappu/GN/src/components/WebsiteCMS.jsx';
let content = fs.readFileSync(file, 'utf8');

// The string to find
const target = "style={{ width: '100%', marginTop: '0.25rem' }}";
const replacement = "style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }}";

// Replace globally
content = content.split(target).join(replacement);

fs.writeFileSync(file, content);
console.log("Fixed input styles!");
