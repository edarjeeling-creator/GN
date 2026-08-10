export const studentHouseMap = {
  // Class 5 A
  'aftab muzzammil': 'Topaz',
  'alam farhan': 'Turquoise',
  'chettri aarush': 'Turquoise',
  'chettri zabien': 'Onyx',
  'chhetri prayan': 'Turquoise',
  'chhetri riyanshika': 'Topaz',
  'dorje palden': 'Onyx',
  'garg anmol': 'Turquoise',
  'ghalay anukriti': 'Topaz',
  'ghatraj jeshanah': 'Garnet',
  'gupta siddhi': 'Turquoise',
  'gurung ananiya': 'Topaz',
  'khatri ridhika': 'Garnet',
  'kumari shivani': 'Garnet',
  'rai emmanuel': 'Topaz',
  'roy joy': 'Turquoise',
  'sherpa rewang': 'Garnet',
  'shil ujjwal': 'Onyx',
  'siryal aahan': 'Turquoise',
  'tamang choshin': 'Onyx',
  'tamang pema tsewang': 'Garnet',
  'tamang pragyal': 'Onyx',
  'tamang tsheten': 'Garnet',
  'thapa aarav': 'Onyx',
  'thapa rushesh': 'Turquoise',
  'thapa samride': 'Garnet',
  'thapa shreeyas': 'Topaz',
  
  // Class 5 B
  'bhutia tenzing sangbo': 'Onyx',
  'chettri ashiya': 'Turquoise',
  'chettri sameep': 'Garnet',
  'chhetri mohit': 'Topaz',
  'diyali atharva': 'Garnet',
  'ghising kritagya': 'Topaz',
  'gurung abi': 'Topaz',
  'gurung alex': 'Turquoise',
  'gurung anugya': 'Turquoise',
  'gurung reyansh': 'Onyx',
  'gurung shreyas': 'Onyx',
  'karki shriyansh': 'Turquoise',
  'mangrati priyanshu': 'Onyx',
  'mukhia jenessa': 'Garnet',
  'pradhan arush': 'Garnet',
  'pradhan diyashree': 'Topaz',
  'pradhan pratistha': 'Turquoise',
  'rai ansh': 'Garnet',
  'rai aratrika': 'Onyx',
  'sherpa palden': 'Topaz',
  'sherpa regen': 'Turquoise',
  'tamang aaryashang': 'Topaz',
  'tamang abhiyant': 'Garnet',
  'tamang mingyur dorjee': 'Onyx',
  'tamang swarnavi': 'Garnet'
};

export const getStudentHouse = (name) => {
  if (!name) return null;
  // Try exact match first
  let house = studentHouseMap[name.toLowerCase().trim()];
  if (house) return house;
  
  // Try matching words if order is different in db
  const parts = name.toLowerCase().trim().split(' ').sort();
  for (const [key, value] of Object.entries(studentHouseMap)) {
    const keyParts = key.split(' ').sort();
    if (parts.length === keyParts.length && parts.every((p, i) => p === keyParts[i])) {
      return value;
    }
  }
  return null;
};
