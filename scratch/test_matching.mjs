const subjectClusters = [
  ['english 1', 'english paper 1', 'eng1', 'engi', 'eng 1', 'english i', 'english-1', 'english language'],
  ['english 2', 'english paper 2', 'eng2', 'eng 2', 'english ii', 'english-2', 'english literature'],
  ['second language', 'geng', '2nd lang', 'second lang', 'general english', '2nd language', '2ndl', '2l', 'secondl'],
  ['third language', '3rd lang', 'third lang', '3rd language', '3rdl', '3l', 'thirdl', 'tl'],
  ['nepali', 'nep', 'nepal'],
  ['hindi', 'hin'],
  ['mathematics', 'math', 'maths'],
  ['physics', 'phy', 'phys'],
  ['chemistry', 'chem'],
  ['biology', 'bio', 'biol'],
  ['physical education', 'pe', 'physical ed'],
  ['economics', 'eco', 'econ'],
  ['history', 'hist', 'his'],
  ['geography', 'geog', 'geo'],
  ['political science', 'pol sc', 'pol. sc.', 'pol science', 'polsc'],
  ['sociology', 'soc', 'socio'],
  ['general knowledge', 'gk', 'general'],
  ['computer application', 'computer', 'comp', 'computer science', 'cs']
];

const subjects = [
  { name: "EngI" },
  { name: "Eng2" },
  { name: "Math" },
  { name: "Phy" },
  { name: "Chem" },
  { name: "Bio" },
  { name: "History" },
  { name: "General Knowledge" },
  { name: "2nd Language" },
  { name: "3rd Language" },
  { name: "Computer Application " },
  { name: "Geography" }
];

const row = {
  "Eng1": 80,
  "Eng2": 80,
  "Math": 80,
  "Phy": 80,
  "Chem": 80,
  "Bio": 80,
  "Hist": 80,
  "GK": 93,
  "2nd L": 80,
  "TL": 80,
  "Comp": 80,
  "Geog": 80
};

let matchedSubjectsCount = 0;
const matchedNames = [];

subjects.forEach(sub => {
  const normalizedSubName = sub.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const excelHeader = Object.keys(row).find(key => {
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

  if (excelHeader && row[excelHeader] !== undefined && row[excelHeader] !== '') {
    matchedSubjectsCount++;
    matchedNames.push(`${sub.name} -> ${excelHeader}`);
  } else {
    console.log(`FAILED TO MATCH: ${sub.name}`);
  }
});

console.log(`Total matched: ${matchedSubjectsCount}`);
console.log(matchedNames);
