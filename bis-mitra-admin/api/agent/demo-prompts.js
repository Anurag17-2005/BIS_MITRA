/** Judge demo prompts for SIH evaluation walkthrough */
export const DEMO_PROMPTS = [
  {
    id: 'geyser-rules',
    label: 'A1. Geyser rules',
    text: 'Hey, I just built a home geyser prototype in my workshop. What official government rules or codes do I need to follow before I can sell it in India?',
    personaHint: 'industry',
  },
  {
    id: 'geyser-mandatory',
    label: 'A2. QCO mandatory?',
    text: 'Is it legally mandatory for me to get this certificate right now, or is it voluntary? Can I launch on Amazon now and apply later?',
    personaHint: 'industry',
  },
  {
    id: 'geyser-roadmap',
    label: 'A3. Roadmap & cost',
    text: 'Okay, I do not want to break the law. What is the fastest step-by-step way for a small startup like me to get this license, and how much will it cost?',
    personaHint: 'industry',
  },
  {
    id: 'geyser-sit',
    label: 'A4. Factory SIT',
    text: 'What testing machinery do I physically need to buy and install on my factory floor to pass the initial BIS officer inspection?',
    personaHint: 'industry',
  },
  {
    id: 'geyser-lab',
    label: 'A5. Lab Pune',
    text: 'Where can I send my geyser sample to get tested right now? Find me an active lab near Pune with the shortest waiting queue.',
    personaHint: 'industry',
  },
  {
    id: 'helmet-variant',
    label: 'B1. Helmet variant',
    text: 'I have an active BIS license for helmets. I want to add a new larger shell size model to my production line. Do I need to apply for a whole new license from scratch?',
    personaHint: 'industry',
  },
  {
    id: 'helmet-alert',
    label: 'C1. Critical alert',
    text: 'Show me the critical alert details. What changed on the portal?',
    personaHint: 'industry',
  },
  {
    id: 'helmet-amendment',
    label: 'C2. Clause delta',
    text: 'What exact numbers or testing limits did this new Amendment 1 change in Clause 4.2?',
    personaHint: 'industry',
  },
  {
    id: 'citizen-toys',
    label: 'C1. Toy safety IS 9873',
    text: 'I am buying plastic toys for my 3-year-old child. What basic safety tests or toxin limits must a toy clear to get an official BIS safety mark?',
    personaHint: 'consumer',
  },
  {
    id: 'citizen-grievance',
    label: 'C2. File complaint',
    text: 'My new extension board caught fire this morning while charging my phone. I have the store bill. Can you file an official complaint against this brand for me?',
    personaHint: 'consumer',
  },
  {
    id: 'citizen-track',
    label: 'C3. Track complaint',
    text: 'Has the enforcement team taken any action on the complaint I filed yesterday against the defective extension board brand?',
    personaHint: 'consumer',
  },
  {
    id: 'citizen-jargon',
    label: 'C4. Jargon decoder',
    text: 'My room heater box talks about passing a \'2000V Dielectric High-Voltage Insulation test.\' Can you translate that into plain language for me?',
    personaHint: 'consumer',
  },
  {
    id: 'citizen-dispute',
    label: 'C5. Refund dispute',
    text: 'The shopkeeper refuses to refund me for a defective geyser, claiming BIS certification isn\'t mandatory. What legal clause can I show them to prove they are wrong?',
    personaHint: 'consumer',
  },
  {
    id: 'citizen-counterfeit',
    label: 'C6. CM/L verify',
    text: 'I am holding a helmet with a BIS license stamp that says CM/L-4151999. Can you check the live database to tell me if this is a real factory license?',
    personaHint: 'consumer',
  },
  {
    id: 'citizen-hindi',
    label: 'C7. Hindi rights',
    text: 'I am buying a gold ring. Tell me my basic checking rights in simple Hindi language.',
    personaHint: 'consumer',
  },
  {
    id: 'citizen-hazard',
    label: 'C8. Hazard flag',
    text: 'This local store is selling cheap unbranded baby feeding bottles that smell intensely like toxic industrial plastic. Flag this as an immediate hazard.',
    personaHint: 'consumer',
  },
];
