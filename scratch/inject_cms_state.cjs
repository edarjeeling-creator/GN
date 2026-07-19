const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src/components/WebsiteCMS.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Inject State Variables
const stateInjectionPoint = "  // Our Divisions & Campus Desks State";
const stateCode = `
  // New CMS States for Redesign
  const [welcomeSection, setWelcomeSection] = useState({ badge: '', title: '', description: '', linkText: '', linkUrl: '' });
  const [leadershipMessage, setLeadershipMessage] = useState({ badge: '', title: '', message: '', name: '', imageUrl: '', btnText: '', btnUrl: '' });
  const [whyChooseUs, setWhyChooseUs] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [ctaSection, setCtaSection] = useState({ title: '', description: '', btn1Text: '', btn1Url: '', btn2Text: '', btn2Url: '' });
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', location: '' });
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [savingLeadership, setSavingLeadership] = useState(false);
  const [savingWhyChooseUs, setSavingWhyChooseUs] = useState(false);
  const [savingTestimonials, setSavingTestimonials] = useState(false);
  const [savingCta, setSavingCta] = useState(false);
`;
if (!content.includes('// New CMS States for Redesign')) {
  content = content.replace(stateInjectionPoint, stateCode + '\n' + stateInjectionPoint);
}

// 2. Inject useEffect calls
const useEffectPoint = "fetchNews();";
const useEffectCode = `fetchNews();
    fetchWelcomeSection();
    fetchLeadershipMessage();
    fetchWhyChooseUs();
    fetchTestimonials();
    fetchCtaSection();
    fetchEvents();`;
if (!content.includes('fetchWelcomeSection()')) {
  content = content.replace(useEffectPoint, useEffectCode);
}

// 3. Inject Functions
const funcInjectionPoint = "  const fetchNews = async () => {";
const funcCode = `
  const fetchWelcomeSection = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'welcome_section').single();
    if (data && data.value) setWelcomeSection(JSON.parse(data.value));
  };
  const saveWelcomeSection = async (e) => {
    if(e) e.preventDefault(); setSavingWelcome(true);
    await supabase.from('site_settings').upsert({ key: 'welcome_section', value: JSON.stringify(welcomeSection) }, { onConflict: 'key,school_id' });
    setSavingWelcome(false); alert("Welcome section saved!");
  };

  const fetchLeadershipMessage = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'leadership_message').single();
    if (data && data.value) setLeadershipMessage(JSON.parse(data.value));
  };
  const saveLeadershipMessage = async (e) => {
    if(e) e.preventDefault(); setSavingLeadership(true);
    await supabase.from('site_settings').upsert({ key: 'leadership_message', value: JSON.stringify(leadershipMessage) }, { onConflict: 'key,school_id' });
    setSavingLeadership(false); alert("Leadership message saved!");
  };

  const fetchWhyChooseUs = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'why_choose_us').single();
    if (data && data.value) setWhyChooseUs(JSON.parse(data.value));
  };
  const saveWhyChooseUs = async (e) => {
    if(e) e.preventDefault(); setSavingWhyChooseUs(true);
    await supabase.from('site_settings').upsert({ key: 'why_choose_us', value: JSON.stringify(whyChooseUs) }, { onConflict: 'key,school_id' });
    setSavingWhyChooseUs(false); alert("Why Choose Us saved!");
  };

  const fetchTestimonials = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'testimonials').single();
    if (data && data.value) setTestimonials(JSON.parse(data.value));
  };
  const saveTestimonials = async (e) => {
    if(e) e.preventDefault(); setSavingTestimonials(true);
    await supabase.from('site_settings').upsert({ key: 'testimonials', value: JSON.stringify(testimonials) }, { onConflict: 'key,school_id' });
    setSavingTestimonials(false); alert("Testimonials saved!");
  };

  const fetchCtaSection = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'cta_section').single();
    if (data && data.value) setCtaSection(JSON.parse(data.value));
  };
  const saveCtaSection = async (e) => {
    if(e) e.preventDefault(); setSavingCta(true);
    await supabase.from('site_settings').upsert({ key: 'cta_section', value: JSON.stringify(ctaSection) }, { onConflict: 'key,school_id' });
    setSavingCta(false); alert("CTA Section saved!");
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data) setEvents(data);
  };
  const handleAddEvent = async (e) => {
    if(e) e.preventDefault();
    if (!newEvent.title || !newEvent.date) return;
    await supabase.from('events').insert([newEvent]);
    setNewEvent({ title: '', date: '', location: '' });
    fetchEvents();
  };
  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Delete event?")) return;
    await supabase.from('events').delete().match({ id });
    fetchEvents();
  };
`;
if (!content.includes('const fetchWelcomeSection = async () => {')) {
  content = content.replace(funcInjectionPoint, funcCode + '\n' + funcInjectionPoint);
}

// Write back
fs.writeFileSync(filePath, content, 'utf-8');
console.log("Successfully injected state and functions.");
