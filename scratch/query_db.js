import dotenv from 'dotenv';
const c1 = dotenv.config({ path: '.env' }).parsed || {};
const c2 = dotenv.config({ path: '.env.local' }).parsed || {};
console.log("ENV VARS:", Object.keys({...c1, ...c2}));
