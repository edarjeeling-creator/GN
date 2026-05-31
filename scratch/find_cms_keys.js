const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\edarj\\.gemini\\antigravity\\scratch\\grade-management-system\\src\\components\\WebsiteCMS.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('site_settings') || line.includes('our_divisions') || line.includes('hero_styling')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
