export const PERSONAS = [
  { id: 'industry', short: 'Industry', label: 'Industry (Manufacturer)', icon: '🏭', agentMode: 'industry', density: 'medium' },
  { id: 'foreign_exporter', short: 'Foreign Exporter', label: 'Foreign Exporter', icon: '🌐', agentMode: 'industry', density: 'medium' },
  { id: 'citizen', short: 'Citizen', label: 'General Citizen', icon: '👤', agentMode: 'consumer', density: 'simple' },
  { id: 'gold_investor', short: 'Gold Buyer', label: 'Gold Buyer', icon: '💍', agentMode: 'consumer', density: 'simple' },
  { id: 'lab_testing', short: 'Laboratory', label: 'Laboratory', icon: '🔬', agentMode: 'industry', density: 'technical' },
  { id: 'academic', short: 'Researcher', label: 'Researcher', icon: '🎓', agentMode: 'industry', density: 'technical' },
  { id: 'enforcement', short: 'Enforcement Officer', label: 'Enforcement Officer', icon: '🛃', agentMode: 'industry', density: 'technical' },
  { id: 'bis_admin', short: 'BIS Officer', label: 'BIS Officer', icon: '🏛️', agentMode: 'industry', density: 'technical' },
];

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}

export const PROFILES = {
  industry: {
    name: 'Rahul Mehta',
    org: 'NovaShield Safety Products Pvt. Ltd.',
    city: 'Pune',
    products: 'Industrial safety helmet — Model NSH-1001',
    market: 'Maharashtra',
    udyam: 'UDYAM-MH-12-0012345',
    email: 'compliance@novashield.demo',
  },
  foreign_exporter: { name: 'A. Chen', org: 'Northwind Exports', city: '', products: '', country: '', air_name: '' },
  citizen: { name: 'Priya Shah', org: 'General public' },
  gold_investor: { name: 'Priya Shah', org: 'Jewellery buyer' },
  lab_testing: { name: 'Dr. S. Iyer', org: 'NABL applicant laboratory' },
  academic: { name: 'Dr. S. Iyer', org: 'Standards research' },
  enforcement: { name: 'Inspector Kulkarni', org: 'BIS Enforcement', city: '', products: '', market: '', udyam: '' },
  bis_admin: {
    name: 'Case Officer',
    org: 'BIS Certification',
    city: 'New Delhi',
    desk: 'Product certification queue',
    role: 'Case Officer',
  },
};

export function profileFor(id) {
  return PROFILES[id] || { name: 'BIS user', org: 'Bureau of Indian Standards' };
}

export const QUICK_BY_PERSONA = {
  industry: [
    { icon: '📘', label: 'Helmet compliance', prompt: 'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?', promptHi: 'मैं औद्योगिक सुरक्षा हेलमेट बनाता हूँ। मेरे उत्पाद पर कौन सा BIS मानक लागू होता है, क्या प्रमाणन अनिवार्य है, और मुझे कौन से परीक्षण और दस्तावेज़ चाहिए?' },
    { icon: '✓', label: 'Mandatory?', prompt: 'Is certification mandatory for industrial safety helmets under IS DEMO 1001:2026?', promptHi: 'क्या IS DEMO 1001:2026 के तहत औद्योगिक सुरक्षा हेलमेट के लिए प्रमाणन अनिवार्य है?' },
    { icon: '🗺️', label: 'Certification steps', prompt: 'What is the BIS certification process for my industrial safety helmet?', promptHi: 'मेरे औद्योगिक सुरक्षा हेलमेट के लिए BIS प्रमाणन की प्रक्रिया क्या है?' },
    { icon: '📝', label: 'Apply now', prompt: 'I want to apply for certification for my industrial safety helmet. Help me complete and submit the application.', promptHi: 'मैं अपने औद्योगिक सुरक्षा हेलमेट के लिए प्रमाणन हेतु आवेदन करना चाहता हूँ। आवेदन पूरा करने और जमा करने में मेरी मदद करें।' },
    { icon: '▣', label: 'Application status', prompt: 'What is the status of my BIS certification application BIS-APP-CERT-DEMO-001?', promptHi: 'मेरे BIS प्रमाणन आवेदन BIS-APP-CERT-DEMO-001 की स्थिति क्या है?' },
    { icon: '🧪', label: 'Tests required', prompt: 'What tests do I need to perform for IS 2082 water heater certification?', promptHi: 'IS 2082 वॉटर हीटर प्रमाणन के लिए मुझे कौन से परीक्षण करने होंगे?' },
    { icon: '💰', label: 'Fee estimate', prompt: 'Calculate the BIS marking fees for my water heater application.', promptHi: 'मेरे वॉटर हीटर आवेदन के लिए BIS मार्किंग शुल्क की गणना करें।' },
    { icon: '🔬', label: 'Lab near Pune', prompt: 'Which BIS recognised laboratory near Pune can test my water heater?', promptHi: 'पुणे के पास कौन सी BIS मान्यता प्राप्त प्रयोगशाला मेरे वॉटर हीटर का परीक्षण कर सकती है?' },
  ],
  foreign_exporter: [
    { icon: '🚢', label: 'FMCS requirements', prompt: 'What are the FMCS requirements to export to India?', promptHi: 'भारत को निर्यात करने के लिए FMCS की क्या आवश्यकताएँ हैं?' },
    { icon: '📋', label: 'Start application', prompt: 'I want to apply for an FMCS licence', promptHi: 'मैं FMCS लाइसेंस के लिए आवेदन करना चाहता हूँ।' },
    { icon: '🔍', label: 'Check status', prompt: 'What is the status of my FMCS application?', promptHi: 'मेरे FMCS आवेदन की स्थिति क्या है?' },
  ],
  citizen: [
    { icon: '💬', label: 'File a Complaint', prompt: 'I want to file a consumer complaint about a defective product', promptHi: 'मैं एक दोषपूर्ण उत्पाद के बारे में उपभोक्ता शिकायत दर्ज करना चाहता हूँ।' },
    { icon: '🔎', label: 'Verify product', prompt: 'How do I check if a product has a genuine BIS mark?', promptHi: 'मैं कैसे जाँचूँ कि किसी उत्पाद पर असली BIS चिह्न है?' },
    { icon: '📘', label: 'Safety guidance', prompt: 'What safety checks should I do before buying a helmet?', promptHi: 'हेलमेट खरीदने से पहले मुझे कौन सी सुरक्षा जाँच करनी चाहिए?' },
  ],
  gold_investor: [
    { icon: '💎', label: 'Verify HUID', prompt: 'Verify HUID A1B2C3', promptHi: 'HUID A1B2C3 सत्यापित करें।' },
    { icon: '💍', label: 'Hallmark meaning', prompt: 'What does the 22K916 hallmark stamp mean?', promptHi: '22K916 हॉलमार्क स्टाम्प का क्या अर्थ है?' },
    { icon: '⚠️', label: 'Report jeweller', prompt: 'I want to report a jeweller selling gold without HUID', promptHi: 'मैं एक ऐसे ज्वैलर की रिपोर्ट करना चाहता हूँ जो HUID के बिना सोना बेच रहा है।' },
  ],
  lab_testing: [
    { icon: '🔬', label: 'Lab recognition', prompt: 'How do I apply for BIS laboratory recognition?', promptHi: 'मैं BIS प्रयोगशाला मान्यता के लिए कैसे आवेदन करूँ?' },
    { icon: '🧪', label: 'Inspection status', prompt: 'What is the status of my laboratory recognition application?', promptHi: 'मेरे प्रयोगशाला मान्यता आवेदन की स्थिति क्या है?' },
    { icon: '📘', label: 'Test requirements', prompt: 'What are the room conditions for IS 1786 mechanical tests?', promptHi: 'IS 1786 यांत्रिक परीक्षणों के लिए कमरे की क्या परिस्थितियाँ होनी चाहिए?' },
  ],
  academic: [
    { icon: '📘', label: 'Open a standard', prompt: 'What is IS 2925:1984?', promptHi: 'IS 2925:1984 क्या है?' },
    { icon: '⇄', label: 'Compare standards', prompt: 'Compare IS 2925:1984 and IS 2925 (Part 1):2019', promptHi: 'IS 2925:1984 और IS 2925 (भाग 1):2019 की तुलना करें।' },
    { icon: '📄', label: 'Related documents', prompt: 'Show related documents for helmet standards', promptHi: 'हेलमेट मानकों से संबंधित दस्तावेज़ दिखाएँ।' },
  ],
  enforcement: [
    { icon: '🛃', label: 'Open a case', prompt: 'Show the status of enforcement case ENF-RAID-001', promptHi: 'प्रवर्तन मामले ENF-RAID-001 की स्थिति दिखाएँ।' },
    { icon: '🔎', label: 'Verify licence', prompt: 'Is licence CM/L-8830112 active or suspended?', promptHi: 'क्या लाइसेंस CM/L-8830112 सक्रिय है या निलंबित?' },
    { icon: '📘', label: 'Related standard', prompt: 'Which standard applies to this seized helmet consignment?', promptHi: 'इस जब्त हेलमेट खेप पर कौन सा मानक लागू होता है?' },
  ],
  bis_admin: [
    { icon: '▣', label: 'Waiting cases', prompt: 'Which certification applications are waiting for action?', promptHi: 'कौन से प्रमाणन आवेदन कार्रवाई की प्रतीक्षा में हैं?' },
    { icon: '🔬', label: 'Delayed tests', prompt: 'Which laboratory tests are delayed?', promptHi: 'कौन से प्रयोगशाला परीक्षण विलंबित हैं?' },
    { icon: '📘', label: 'Amendments', prompt: 'Which amendments affect active licences?', promptHi: 'कौन से संशोधन सक्रिय लाइसेंस को प्रभावित करते हैं?' },
  ],
};
