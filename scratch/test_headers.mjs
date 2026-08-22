const subjectClusters = [
  ['english 1', 'english paper 1', 'eng1', 'engi', 'eng 1', 'english i', 'english-1', 'english language'],
  ['english 2', 'english paper 2', 'eng2', 'eng 2', 'english ii', 'english-2', 'english literature'],
  ['second language', 'geng', '2nd lang', 'second lang', 'general english', '2nd language', '2ndl', '2l', 'secondl'],
  ['third language', '3rd lang', 'third lang', '3rd language', '3rdl', '3l', 'thirdl', 'tl'],
  ['nepali', 'nep', 'nepal'],
  ['hindi', 'hin'],
  ['mathematics', 'math', 'maths'],
  ['science', 'sci'],
  ['physics', 'phy'],
  ['chemistry', 'chem', 'che'],
  ['biology', 'bio'],
  ['history', 'hist', 'his'],
  ['geography', 'geog', 'geo'],
  ['political science', 'pol sc', 'pol. sc.', 'pol science', 'polsc'],
  ['sociology', 'soc', 'socio'],
  ['general knowledge', 'gk', 'general'],
  ['computer application', 'computer', 'comp', 'computer science', 'cs']
];

const databaseSubjects = [
  { name: 'EngI' },
  { name: 'Eng2' },
  { name: '2nd Language' },
  { name: 'Bio' },
  { name: 'Phy' },
  { name: 'Chem' },
  { name: 'Math' },
  { name: 'History' },
  { name: 'Geography' },
  { name: 'Computer Application' },
  { name: 'General Knowledge' },
  { name: '3rd Language' }
];

const excelHeaders = ['Eng1', 'Eng2', '2nd L', 'Bio', 'Phy', 'Chem', 'Math', 'Hist', 'Geog', 'Comp', 'GK', 'TL'];

let matchedCount = 0;

databaseSubjects.forEach(sub => {
  const normalizedSubName = sub.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const matchedHeader = excelHeaders.find(key => {
    const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKey === normalizedSubName) return true;
    
    for (const cluster of subjectClusters) {
       const cleanCluster = cluster.map(c => c.replace(/[^a-z0-9]/g, ''));
       if (cleanCluster.includes(normalizedSubName) && cleanCluster.includes(normalizedKey)) {
          return true;
       }
    }
    
    if (normalizedKey.length >= 4 && normalizedSubName.includes(normalizedKey)) return true;
    if (normalizedSubName.length >= 4 && normalizedKey.includes(normalizedSubName)) return true;

    return false;
  });

  if (matchedHeader) {
    console.log(`Match: DB '${sub.name}' -> Excel '${matchedHeader}'`);
    matchedCount++;
  } else {
    console.log(`NO MATCH FOR: DB '${sub.name}'`);
  }
});
console.log(`Total Matched: ${matchedCount}`);
