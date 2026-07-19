const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.jsx', 'utf-8');

// Handle News empty state
code = code.replace('{news.map(item => (', '{news.length > 0 ? news.map(item => (')
           .replace('</div>\n            </div>\n\n          {/* Events */}', '</div>\n              ) : (\n                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-500">No news available at the moment.</div>\n              )}\n            </div>\n          </div>\n\n          {/* Events */}');

// Handle Events empty state
code = code.replace('{events.map(event => (', '{events.length > 0 ? events.map(event => (')
           .replace('</div>\n            </div>\n          </div>\n        </div>', '</div>\n              ) : (\n                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-500">No upcoming events scheduled.</div>\n              )}\n            </div>\n          </div>\n        </div>');

// Hide testimonials section if empty
code = code.replace('<div className="bg-[#0f172a] py-24 relative overflow-hidden">', '{testimonials.length > 0 && (\n      <div className="bg-[#0f172a] py-24 relative overflow-hidden">')
           .replace('</div>\n\n      {/* 9. CTA */}', '</div>\n      )}\n\n      {/* 9. CTA */}');

// Add loading="lazy" to images
code = code.replace(/<img src=\{/g, '<img loading="lazy" src={');

fs.writeFileSync('src/pages/Home.jsx', code);
console.log("Fixed Home.jsx");
