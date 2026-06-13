export interface HelpFaq {
  question: string;
  answer: string;
}

export interface HelpTopic {
  slug: string;
  title: string;
  description: string;
  intro: string;
  steps: string[];
  faqs: HelpFaq[];
  emergencyType?: "trauma" | "poisoning" | "respiratory";
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: "trauma",
    title: "Pet Trauma Emergency",
    description:
      "What to do if your pet is injured in an accident — broken bones, wounds, or hit by a vehicle in the Philippines.",
    intro:
      "Trauma emergencies need fast action. Keep your pet as still and calm as possible, control visible bleeding with clean pressure, and call an emergency vet before you drive — not every clinic can handle surgery or critical care at all hours.",
    steps: [
      "Move your pet carefully onto a flat surface or carrier; support the body if you suspect spinal injury.",
      "Apply gentle pressure to bleeding wounds with a clean cloth — do not remove embedded objects.",
      "Avoid giving food, water, or human pain medication unless a vet instructs you.",
      "Call the nearest emergency-capable clinic and describe the injury so they can prepare.",
      "Transport with minimal movement; have someone monitor breathing during the trip.",
    ],
    emergencyType: "trauma",
    faqs: [
      {
        question: "Should I go to the nearest vet or an emergency clinic?",
        answer:
          "Call first. A regular clinic may be closed or unable to perform surgery. Use Vet247PH to find emergency-capable clinics near you and confirm they can accept trauma cases before traveling.",
      },
      {
        question: "Can I give my pet pain medicine before we leave?",
        answer:
          "Do not give human medications like ibuprofen or paracetamol unless a veterinarian tells you to — many are toxic to dogs and cats.",
      },
      {
        question: "My pet was hit by a car but seems fine — should I still go?",
        answer:
          "Yes. Internal bleeding and organ damage may not show symptoms for hours. A vet exam is strongly recommended after any significant impact.",
      },
    ],
  },
  {
    slug: "poisoning",
    title: "Pet Poisoning Emergency",
    description:
      "Steps to take if your dog or cat ate something toxic — chocolate, rat poison, medications, or household chemicals in the Philippines.",
    intro:
      "Poisoning timelines vary widely. Identify what was ingested if you can, note the approximate amount and time, and call an emergency vet immediately — do not wait for symptoms if you know a toxic substance was consumed.",
    steps: [
      "Remove your pet from the source and prevent them from eating more.",
      "Check the product label or packaging and note the active ingredient.",
      "Call an emergency vet — do not induce vomiting unless they instruct you.",
      "Do not give milk, oil, salt water, or home remedies without veterinary guidance.",
      "Bring the packaging, vomit sample (if safe), and a list of medications your pet takes.",
    ],
    emergencyType: "poisoning",
    faqs: [
      {
        question: "Should I make my pet vomit at home?",
        answer:
          "Only if a veterinarian or poison control professional tells you to. Vomiting can worsen damage with corrosive or petroleum-based products.",
      },
      {
        question: "Chocolate, grapes, and onions — are these really emergencies?",
        answer:
          "They can be, depending on the amount and your pet's size. Call a vet with the type and quantity — do not assume a small amount is safe.",
      },
      {
        question: "How fast do I need to act?",
        answer:
          "As quickly as possible. Some toxins absorb within minutes. Calling ahead lets the clinic advise immediate steps and prepare treatment.",
      },
    ],
  },
  {
    slug: "breathing-difficulty",
    title: "Pet Breathing Emergency",
    description:
      "What to do if your dog or cat is struggling to breathe, choking, or has blue gums — respiratory emergencies in the Philippines.",
    intro:
      "Breathing difficulty is a true emergency. Keep your pet cool and calm, avoid tight collars or muzzles, and get to an emergency vet immediately while someone calls ahead to confirm the clinic is open and equipped.",
    steps: [
      "Stay calm and speak softly — stress can worsen breathing distress.",
      "Remove collars, harnesses, or anything around the neck.",
      "Open windows or use air conditioning — avoid overheating.",
      "If choking is suspected and you can see a visible object, try to remove it carefully — avoid pushing it deeper.",
      "Call an emergency vet while en route; blue or pale gums need urgent care.",
    ],
    emergencyType: "respiratory",
    faqs: [
      {
        question: "What signs mean breathing is an emergency?",
        answer:
          "Open-mouth breathing in cats, exaggerated chest movement, coughing up foam, collapse, or gums that look blue, gray, or very pale all warrant immediate veterinary care.",
      },
      {
        question: "Can I use a nebulizer or human inhaler on my pet?",
        answer:
          "Do not use human medications without veterinary instruction. Some inhalers help specific conditions but the wrong drug or dose can be dangerous.",
      },
      {
        question: "Should I muzzle my dog for the car ride?",
        answer:
          "No if breathing is compromised. A muzzle restricts air flow. Use a carrier or have a second person help restrain gently if needed.",
      },
    ],
  },
];

export const GENERAL_HELP_FAQS: HelpFaq[] = [
  {
    question: "Should I call the vet before traveling?",
    answer:
      "Yes — always. Clinic hours, emergency capacity, and staffing change frequently. Calling first confirms the clinic is open, accepting emergencies, and can handle your pet's situation.",
  },
  {
    question: "How do I find a 24/7 emergency vet in the Philippines?",
    answer:
      "Use Vet247PH to search by your location or browse area pages for Metro Manila, Cebu, Davao, and other regions. Filter for emergency-capable clinics and call before you leave.",
  },
  {
    question: "Is Vet247PH a substitute for veterinary advice?",
    answer:
      "No. Vet247PH is an informational directory only. For diagnosis and treatment, contact a licensed veterinarian directly.",
  },
  {
    question: "What if no clinics appear near me?",
    answer:
      "Try a broader area search, turn off the emergency-only filter, or browse nearby cities on our area pages. In a life-threatening emergency, call any veterinary clinic for guidance even if they are not listed as 24/7.",
  },
];

export function getHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.slug === slug);
}
