const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\edarj\\.gemini\\antigravity\\scratch\\grade-management-system\\src\\public.css', 'utf8');

const regex = /\.facility-card[\s\S]*?\}/g;
const matches = content.match(regex);
if (matches) {
  matches.forEach(m => console.log(m));
} else {
  console.log("No matches found for .facility-card");
}
