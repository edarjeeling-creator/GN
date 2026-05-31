const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('import Layout from') || content.includes('<Layout>')) {
    console.log(`Fixing ${file}...`);
    // Remove the import line
    content = content.replace(/import Layout from ['"]\.\.\/components\/Layout['"];?\r?\n?/g, '');
    
    // Replace <Layout> with <>
    content = content.replace(/<Layout>/g, '<>');
    
    // Replace </Layout> with </>
    content = content.replace(/<\/Layout>/g, '</>');
    
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
console.log('Done!');
