const fs = require('fs');
const file = '/home/nodiappu/GN/src/pages/Home.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add LucideIcons import if not there
if (!content.includes('import * as LucideIcons')) {
  content = content.replace(
    "import { ChevronRight, Play, BookOpen, Users, Award, FileText, Phone, CheckCircle, ArrowRight, Calendar, Star, Trophy, Target, ImageIcon, Megaphone, Bell, Shield } from 'lucide-react';",
    "import { ChevronRight, Play, BookOpen, Users, Award, FileText, Phone, CheckCircle, ArrowRight, Calendar, Star, Trophy, Target, ImageIcon, Megaphone, Bell, Shield } from 'lucide-react';\nimport * as LucideIcons from 'lucide-react';"
  );
}

// 2. We need state for divisionsTitle, divisionsSubtitle, whyChooseUsTitle, whyChooseUsSubtitle, whyChooseUsEnabled, divisionsEnabled
content = content.replace(
  "  const [divisions, setDivisions] = useState([",
  `  const [divisionsTitle, setDivisionsTitle] = useState("Academic Journey");
  const [divisionsSubtitle, setDivisionsSubtitle] = useState("Nurturing growth through every phase of your child's education.");
  const [divisionsEnabled, setDivisionsEnabled] = useState(true);
  const [divisions, setDivisions] = useState([`
);

content = content.replace(
  "  const [whyChooseUs, setWhyChooseUs] = useState([",
  `  const [whyChooseUsTitle, setWhyChooseUsTitle] = useState("Why Choose Us");
  const [whyChooseUsSubtitle, setWhyChooseUsSubtitle] = useState("A holistic approach to education that prepares your child for the future.");
  const [whyChooseUsEnabled, setWhyChooseUsEnabled] = useState(true);
  const [whyChooseUs, setWhyChooseUs] = useState([`
);

// 3. Update the data fetching for our_divisions and why_choose_us
const fetchSettingsOld = `            if (key === 'hero_style' && val) setHeroStyle(val);
            if (key === 'welcome_section' && val) setWelcomeSection(val);
            if (key === 'leadership_message' && val) setLeadershipMessage(val);
            if (key === 'cta_section' && val) setCtaSection(val);
            if (key === 'footer_config' && val) setFooterConfig(val);
            if (key === 'testimonials' && Array.isArray(val)) setTestimonials(val);
            if (key === 'why_choose_us' && Array.isArray(val)) setWhyChooseUs(val);
            if (key === 'our_divisions' && Array.isArray(val)) {
              // Legacy support or new format support if we had it
              setDivisions(val);
            }`;

const fetchSettingsNew = `            if (key === 'hero_style' && val) setHeroStyle(val);
            if (key === 'welcome_section' && val) setWelcomeSection(val);
            if (key === 'leadership_message' && val) setLeadershipMessage(val);
            if (key === 'cta_section' && val) setCtaSection(val);
            if (key === 'footer_config' && val) setFooterConfig(val);
            if (key === 'testimonials' && Array.isArray(val)) setTestimonials(val);
            
            if (key === 'why_choose_us') {
              if (val && val.cards) {
                setWhyChooseUs(val.cards);
                if (val.title) setWhyChooseUsTitle(val.title);
                if (val.subtitle) setWhyChooseUsSubtitle(val.subtitle);
                if (val.enabled !== undefined) setWhyChooseUsEnabled(val.enabled);
              } else if (Array.isArray(val)) {
                setWhyChooseUs(val);
              }
            }
            if (key === 'our_divisions') {
              if (val && val.cards) {
                setDivisions(val.cards);
                if (val.divisionsTitle) setDivisionsTitle(val.divisionsTitle);
                if (val.divisionsSubtitle) setDivisionsSubtitle(val.divisionsSubtitle);
                if (val.enabled !== undefined) setDivisionsEnabled(val.enabled);
              } else if (Array.isArray(val)) {
                setDivisions(val);
              }
            }`;

content = content.replace(fetchSettingsOld, fetchSettingsNew);

// 4. Update the JSX rendering for Academic Journey
const academicJourneyOld = `{/* 4. Academic Journey */}
        <div className="space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Academic Journey</h2>
            <p className="text-slate-600 text-lg">Nurturing growth through every phase of your child's education.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {divisions.map((div, idx) => (
              <Card key={idx} className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col bg-white">
                <CardContent className="p-6 flex flex-col h-full items-start">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                    {iconMap[div.icon] || <BookOpen />}
                  </div>
                  <h3 className="font-bold text-lg mb-3 text-slate-900">{div.title}</h3>
                  <p className="text-sm text-slate-600 flex-grow mb-6">{div.description}</p>
                  <Link to={div.link || '/academics'} className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mt-auto">
                    Learn More <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>`;

const academicJourneyNew = `{/* 4. Academic Journey */}
        {divisionsEnabled && (
        <div className="space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{divisionsTitle}</h2>
            <p className="text-slate-600 text-lg">{divisionsSubtitle}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {divisions.filter(d => d.isActive !== false).map((div, idx) => {
              const IconComp = LucideIcons[div.icon] || LucideIcons.BookOpen;
              return (
              <Card key={idx} className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col bg-white">
                <CardContent className="p-6 flex flex-col h-full items-start">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-3 text-slate-900">{div.title}</h3>
                  <p className="text-sm text-slate-600 flex-grow mb-6">{div.description}</p>
                  <Link to={div.link || '/academics'} className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mt-auto">
                    {div.btnText || 'Learn More'} <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
        )}`;

content = content.replace(academicJourneyOld, academicJourneyNew);

// 5. Update the JSX rendering for Why Choose Us
const whyChooseUsOld = `{/* 5. Why Choose Us */}
        <div className="space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Why Choose Us</h2>
            <p className="text-slate-600 text-lg">A holistic approach to education that prepares your child for the future.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseUs.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-start">
                <div className="w-12 h-12 rounded-xl bg-slate-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  {iconMap[item.icon] || <CheckCircle />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>`;

const whyChooseUsNew = `{/* 5. Why Choose Us */}
        {whyChooseUsEnabled && (
        <div className="space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{whyChooseUsTitle}</h2>
            <p className="text-slate-600 text-lg">{whyChooseUsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseUs.filter(w => w.isActive !== false).map((item, idx) => {
              const IconComp = LucideIcons[item.icon] || LucideIcons.CheckCircle;
              return (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-start hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-slate-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <IconComp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
              );
            })}
          </div>
        </div>
        )}`;

content = content.replace(whyChooseUsOld, whyChooseUsNew);

fs.writeFileSync(file, content);
console.log("Patched Home.jsx");
