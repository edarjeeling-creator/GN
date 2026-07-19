const fs = require('fs');

// 1. Fix Home.jsx
let homeCode = fs.readFileSync('src/pages/Home.jsx', 'utf-8');

// Fix title duplication
const oldTitleBlock = `          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            {heroStyle.title.split('Future-Readiness').map((part, i, arr) => 
              <React.Fragment key={i}>
                <span style={{ color: heroStyle.titleColor }}>{part}</span>
                {i < arr.length - 1 && <span className="text-amber-400">Future-Readiness</span>}
              </React.Fragment>
            )}
            {!heroStyle.title.includes('Future-Readiness') && <span style={{ color: heroStyle.titleColor }}>{heroStyle.title}</span>}
          </h1>`;

const newTitleBlock = `          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            {heroStyle.title.includes('Future-Readiness') ? heroStyle.title.split('Future-Readiness').map((part, i, arr) => 
              <React.Fragment key={i}>
                <span style={{ color: heroStyle.titleColor }}>{part}</span>
                {i < arr.length - 1 && <span className="text-amber-400">Future-Readiness</span>}
              </React.Fragment>
            ) : (
              <span style={{ color: heroStyle.titleColor }}>{heroStyle.title}</span>
            )}
          </h1>`;

homeCode = homeCode.replace(oldTitleBlock, newTitleBlock);

// Add dynamic overlay
const oldOverlayBlock = `          {/* Dark blue overlay for text readability */}
          <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm"></div>`;

const newOverlayBlock = `          {/* Dark blue overlay for text readability */}
          <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: heroStyle.overlayColor || '#0f172a', opacity: heroStyle.overlayOpacity ?? 0.8 }}></div>`;

homeCode = homeCode.replace(oldOverlayBlock, newOverlayBlock);

// Inject defaults into Home.jsx initial state
homeCode = homeCode.replace("btnShape: '9999px', // Fully rounded by default", "btnShape: '9999px', // Fully rounded by default\n    overlayColor: '#0f172a',\n    overlayOpacity: 0.8,");

fs.writeFileSync('src/pages/Home.jsx', homeCode);


// 2. Fix WebsiteCMS.jsx
let cmsCode = fs.readFileSync('src/components/WebsiteCMS.jsx', 'utf-8');

// Inject defaults into WebsiteCMS.jsx initial state
cmsCode = cmsCode.replace("btnShape: '9999px', // Fully rounded by default", "btnShape: '9999px', // Fully rounded by default\n    overlayColor: '#0f172a',\n    overlayOpacity: 0.8,");

// Add inputs to CMS
const colorInputsEnd = `              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Secondary Button</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.btnSecondaryColor} onChange={e => setHeroStyle({...heroStyle, btnSecondaryColor: e.target.value})} />
              </div>
            </div>`;

const newInputs = `              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Secondary Button</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.btnSecondaryColor} onChange={e => setHeroStyle({...heroStyle, btnSecondaryColor: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Overlay Color</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.overlayColor || '#0f172a'} onChange={e => setHeroStyle({...heroStyle, overlayColor: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Overlay Opacity</label>
                <input type="range" min="0" max="1" step="0.1" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.overlayOpacity ?? 0.8} onChange={e => setHeroStyle({...heroStyle, overlayOpacity: parseFloat(e.target.value)})} />
                <span className="text-xs text-slate-500">Value: {heroStyle.overlayOpacity ?? 0.8}</span>
              </div>
            </div>`;

cmsCode = cmsCode.replace(colorInputsEnd, newInputs);

fs.writeFileSync('src/components/WebsiteCMS.jsx', cmsCode);

console.log("Fixed duplication and added overlay controls");
