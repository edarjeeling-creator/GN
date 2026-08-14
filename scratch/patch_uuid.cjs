const fs = require('fs');
const path = './src/context/ChatContext.jsx';
let content = fs.readFileSync(path, 'utf8');

const uuidFunc = `
// Fallback UUID generator
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
`;

content = content.replace(
  "const newConvId = crypto.randomUUID();",
  uuidFunc + "\n      const newConvId = generateUUID();"
);

// Also let's log the error better
content = content.replace(
  "console.error('Failed to create conversation:', error);",
  "console.error('Failed to create conversation:', error); console.log('Error keys:', Object.keys(error || {}));"
);

fs.writeFileSync(path, content);
