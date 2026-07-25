export interface Ingredient {
  amount: string;
  name: string;
  preparation?: string;
}

export interface RecipeStep {
  number: number;
  title: string;
  instruction: string;
  detail: string;
  image?: string;
  imageAlt?: string;
  safety?: string;
}

export interface VisualCheckpoint {
  stepNumber: number;
  question: string;
  guidance: string;
  immediateAction: string;
  requiresMeasurement?: boolean;
}

export interface SafetyNote {
  stepNumber?: number;
  text: string;
}

export interface SuggestedTimer {
  stepNumber: number;
  label: string;
  durationSeconds: number;
  recommendation: "recommended" | "optional";
  cue: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  totalTime: string;
  difficulty: string;
  technique: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  visualCheckpoints: VisualCheckpoint[];
  safetyNotes: SafetyNote[];
  suggestedTimers: SuggestedTimer[];
  isFeatured: boolean;
}

const steakAuPoivre: Recipe = {
  id: "steak-au-poivre",
  title: "Steak au Poivre",
  description: "Pepper-crusted New York strip with a cognac cream pan sauce.",
  totalTime: "35 minutes",
  difficulty: "Intermediate",
  technique: "Searing and pan sauce",
  ingredients: [
    { amount: "1", name: "New York strip steak", preparation: "about 1¼ inches thick" },
    { amount: "1 tsp", name: "kosher salt" },
    { amount: "1½ tbsp", name: "black peppercorns", preparation: "coarsely crushed" },
    { amount: "1 tbsp", name: "neutral high-heat oil" },
    { amount: "2 tbsp", name: "unsalted butter" },
    { amount: "2 cloves", name: "garlic", preparation: "lightly crushed" },
    { amount: "3 sprigs", name: "thyme" },
    { amount: "1 small", name: "shallot", preparation: "finely minced" },
    { amount: "¼ cup", name: "cognac, brandy, or beef stock" },
    { amount: "½ cup", name: "beef stock" },
    { amount: "⅓ cup", name: "heavy cream" }
  ],
  steps: [
    {
      number: 1,
      title: "Pat the steak dry.",
      instruction: "Pat the New York strip completely dry.",
      detail: "Blot every surface with paper towel so the pan can build a proper crust.",
      image: "/recipe-steps/01-pat-dry-1200.jpg",
      imageAlt: "Hands patting a raw New York strip dry with a folded paper towel on a dark prep board.",
      safety: "Wash your hands and sanitize anything that touches raw meat."
    },
    {
      number: 2,
      title: "Season generously.",
      instruction: "Season with salt and crushed peppercorns.",
      detail: "Press the coarsely crushed pepper into both sides so it adheres.",
      image: "/recipe-steps/02-season-1200.jpg",
      imageAlt: "A New York strip being seasoned evenly with salt and coarse crushed peppercorns."
    },
    {
      number: 3,
      title: "Heat the skillet.",
      instruction: "Preheat a heavy skillet until very hot.",
      detail: "Add a thin film of high-smoke-point oil when the pan is ready.",
      image: "/recipe-steps/03-preheat-skillet-1200.jpg",
      imageAlt: "A heavy dark skillet heating on the stove with a thin, shimmering film of oil.",
      safety: "Hot oil can spit. Keep the pan handle turned in and the area dry."
    },
    {
      number: 4,
      title: "Sear the first side.",
      instruction: "Sear the first side.",
      detail: "Lay the steak away from you. Don’t move it until a deep crust forms.",
      image: "/recipe-steps/04-sear-first-side-1200.jpg",
      imageAlt: "A pepper-crusted steak searing undisturbed in a heavy black skillet as a hand lowers it away from the body.",
      safety: "Lower the steak away from your body to avoid hot-oil splatter."
    },
    {
      number: 5,
      title: "Flip and baste.",
      instruction: "Flip, then baste with butter, garlic, and thyme.",
      detail: "Tilt the pan and spoon the foaming butter over the steak repeatedly.",
      image: "/recipe-steps/05-flip-baste-1200.jpg",
      imageAlt: "A browned steak being basted with foaming butter, garlic, and thyme in a tilted skillet.",
      safety: "The pan and butter are extremely hot. Keep a dry towel nearby."
    },
    {
      number: 6,
      title: "Check and rest.",
      instruction: "Check the temperature, then rest the steak.",
      detail: "Use an instant-read thermometer from the side; rest on a warm plate.",
      image: "/recipe-steps/06-check-rest-1200.jpg",
      imageAlt: "An instant-read thermometer inserted into the side of a browned steak beside a warm resting plate.",
      safety: "Appearance alone cannot confirm internal temperature."
    },
    {
      number: 7,
      title: "Soften the shallot.",
      instruction: "Sauté the shallot in the same skillet.",
      detail: "Lower the heat and stir until softened, scraping up the browned fond.",
      image: "/recipe-steps/07-saute-shallot-1200.jpg",
      imageAlt: "Finely chopped shallot being stirred through browned fond in the same skillet."
    },
    {
      number: 8,
      title: "Deglaze the pan.",
      instruction: "Deglaze with cognac, brandy, or stock.",
      detail: "Take the pan off the heat, add the liquid, then return it to the burner.",
      image: "/recipe-steps/08-deglaze-1200.jpg",
      imageAlt: "A measured small cup of deglazing liquid being added to a skillet that has been moved off the burner.",
      safety: "Never pour alcohol from the bottle into a hot pan. Keep it away from flame."
    },
    {
      number: 9,
      title: "Build the sauce.",
      instruction: "Add stock and cream.",
      detail: "Stir until the fond dissolves and the sauce becomes evenly combined.",
      image: "/recipe-steps/09-stock-cream-1200.jpg",
      imageAlt: "Stock and cream combining with the browned fond in a skillet as the sauce is stirred."
    },
    {
      number: 10,
      title: "Reduce gently.",
      instruction: "Reduce the sauce until it coats a spoon.",
      detail: "Keep it at a lively simmer and stir often so the cream doesn’t scorch.",
      image: "/recipe-steps/10-reduce-sauce-1200.jpg",
      imageAlt: "Peppercorn cream sauce clinging to the back of a spoon over a gently simmering skillet."
    },
    {
      number: 11,
      title: "Slice and plate.",
      instruction: "Slice, sauce, and plate.",
      detail: "Cut across the grain, spoon over the pepper sauce, and serve immediately.",
      image: "/recipe-steps/11-slice-plate-1200.jpg",
      imageAlt: "Steak sliced across the grain and plated with glossy peppercorn sauce in a restrained bistro presentation."
    }
  ],
  visualCheckpoints: [
    {
      stepNumber: 3,
      question: "Is the skillet hot enough?",
      guidance: "Look for a thin film of oil that shimmers freely without smoking heavily.",
      immediateAction: "Give the pan another minute if the oil still looks flat."
    },
    {
      stepNumber: 4,
      question: "Is the crust ready?",
      guidance: "Look for a deep brown, evenly developed crust rather than scattered grey patches.",
      immediateAction: "Leave the steak undisturbed for another minute if the surface is still pale."
    },
    {
      stepNumber: 6,
      question: "Is the steak done?",
      guidance: "Appearance cannot establish internal temperature.",
      immediateAction: "Insert an instant-read thermometer from the side before deciding.",
      requiresMeasurement: true
    },
    {
      stepNumber: 10,
      question: "Has the sauce reduced enough?",
      guidance: "The sauce should cling lightly to the back of a spoon.",
      immediateAction: "Simmer a little longer if it runs off like broth."
    }
  ],
  safetyNotes: [
    { stepNumber: 1, text: "Prevent cross-contamination after handling raw steak." },
    { stepNumber: 3, text: "Keep water away from hot oil and turn the pan handle inward." },
    { stepNumber: 4, text: "Lower the steak away from your body to limit splatter." },
    { stepNumber: 5, text: "Use care around the extremely hot pan and foaming butter." },
    { stepNumber: 6, text: "Do not infer internal meat temperature from appearance." },
    {
      stepNumber: 8,
      text: "Never pour alcohol directly from a bottle into a hot pan; keep it away from flame."
    }
  ],
  suggestedTimers: [
    {
      stepNumber: 4,
      label: "First-side sear",
      durationSeconds: 180,
      recommendation: "recommended",
      cue: "Check for a deep crust after three minutes."
    },
    {
      stepNumber: 5,
      label: "Butter baste",
      durationSeconds: 120,
      recommendation: "optional",
      cue: "Check the steak’s internal temperature after basting."
    },
    {
      stepNumber: 6,
      label: "Steak rest",
      durationSeconds: 600,
      recommendation: "recommended",
      cue: "Slice after the ten-minute rest."
    },
    {
      stepNumber: 10,
      label: "Sauce reduction check",
      durationSeconds: 300,
      recommendation: "optional",
      cue: "Check whether the sauce coats a spoon."
    }
  ],
  isFeatured: true
};

const redWineBraisedShortRibs: Recipe = {
  id: "red-wine-braised-short-ribs",
  title: "Red-Wine Braised Short Ribs",
  description: "Beef short ribs slowly braised with red wine, vegetables, herbs, and stock.",
  totalTime: "4 hours",
  difficulty: "Intermediate",
  technique: "Browning and braising",
  ingredients: [
    { amount: "4 lb", name: "bone-in beef short ribs" },
    { amount: "2 tsp", name: "kosher salt" },
    { amount: "1 tsp", name: "black pepper", preparation: "freshly ground" },
    { amount: "2 tbsp", name: "neutral oil" },
    { amount: "1 large", name: "yellow onion", preparation: "diced" },
    { amount: "2", name: "carrots", preparation: "diced" },
    { amount: "2 stalks", name: "celery", preparation: "diced" },
    { amount: "4 cloves", name: "garlic", preparation: "crushed" },
    { amount: "2 tbsp", name: "tomato paste" },
    { amount: "2 cups", name: "dry red wine" },
    { amount: "3 cups", name: "beef stock", preparation: "plus more if needed" },
    { amount: "4 sprigs", name: "thyme" },
    { amount: "2", name: "bay leaves" }
  ],
  steps: [
    {
      number: 1,
      title: "Dry and season.",
      instruction: "Pat the short ribs dry and season generously.",
      detail: "Dry every face, then press salt and pepper evenly over the meat.",
      safety: "Wash your hands and sanitize anything that touches raw beef."
    },
    {
      number: 2,
      title: "Brown deeply.",
      instruction: "Brown every side deeply in a heavy pot.",
      detail: "Work in batches and leave each face undisturbed until it develops a dark mahogany crust.",
      safety: "Hot oil can spit. Lower the ribs away from your body."
    },
    {
      number: 3,
      title: "Cook the vegetables.",
      instruction: "Remove the ribs and cook the onion, carrot, and celery.",
      detail: "Lower the heat and stir until the vegetables soften and color lightly."
    },
    {
      number: 4,
      title: "Darken the tomato paste.",
      instruction: "Add the tomato paste and cook until slightly darkened.",
      detail: "Stir until the paste turns brick red and begins sticking to the pot."
    },
    {
      number: 5,
      title: "Deglaze with wine.",
      instruction: "Deglaze with the measured red wine.",
      detail: "Move the pot off direct flame before adding the wine, then scrape up every browned bit.",
      safety: "Never pour alcohol directly from a bottle into hot cookware or near an open flame."
    },
    {
      number: 6,
      title: "Concentrate the wine.",
      instruction: "Reduce the wine until concentrated.",
      detail: "Return the pot to a steady simmer and reduce the liquid by roughly half."
    },
    {
      number: 7,
      title: "Assemble the braise.",
      instruction: "Add the stock, herbs, and browned short ribs.",
      detail: "The liquid should reach about two-thirds of the way up the ribs, leaving their tops exposed."
    },
    {
      number: 8,
      title: "Braise slowly.",
      instruction: "Cover and braise until tender.",
      detail: "Cook in a 325°F oven and begin checking after 2½ hours; most batches need about 3 hours.",
      safety: "The pot, lid, steam, and braising liquid are extremely hot."
    },
    {
      number: 9,
      title: "Test tenderness.",
      instruction: "Check that the meat yields easily to a fork.",
      detail: "A fork should slide in and twist with little resistance. Keep braising if the meat still feels tight.",
      safety: "A photograph cannot confirm tenderness; use the fork test."
    },
    {
      number: 10,
      title: "Finish the sauce.",
      instruction: "Strain or reduce the sauce and serve.",
      detail: "Skim excess fat and simmer until the sauce is glossy enough to coat the ribs."
    }
  ],
  visualCheckpoints: [
    {
      stepNumber: 2,
      question: "Are the ribs browned enough?",
      guidance: "Look for a dark mahogany crust across each broad face instead of pale grey patches.",
      immediateAction: "Leave pale surfaces undisturbed for another one to two minutes."
    },
    {
      stepNumber: 6,
      question: "Has the wine reduced enough?",
      guidance: "The volume should be about half the starting amount and look slightly glossy.",
      immediateAction: "Continue simmering if the liquid still looks thin and plentiful."
    },
    {
      stepNumber: 7,
      question: "Is there enough braising liquid?",
      guidance: "The liquid should reach roughly two-thirds of the way up the ribs.",
      immediateAction: "Add a little hot stock if the level sits substantially lower."
    },
    {
      stepNumber: 9,
      question: "Are the ribs tender yet?",
      guidance: "Appearance cannot confirm tenderness; a fork should enter and twist easily.",
      immediateAction: "Braise for another 20 to 30 minutes if the meat still resists.",
      requiresMeasurement: true
    }
  ],
  safetyNotes: [
    { stepNumber: 1, text: "Prevent cross-contamination after handling raw beef." },
    { stepNumber: 2, text: "Use care around hot oil and heavy cookware." },
    {
      stepNumber: 5,
      text: "Add measured wine away from direct flame; never pour from the bottle."
    },
    { stepNumber: 8, text: "Open the hot braising pot away from your face to avoid steam." },
    { stepNumber: 9, text: "Do not confirm tenderness from an image alone." }
  ],
  suggestedTimers: [
    {
      stepNumber: 2,
      label: "Short-rib browning side",
      durationSeconds: 180,
      recommendation: "optional",
      cue: "Check one face, then repeat as needed for the remaining sides."
    },
    {
      stepNumber: 6,
      label: "Wine reduction check",
      durationSeconds: 600,
      recommendation: "recommended",
      cue: "Check whether the wine has reduced by roughly half."
    },
    {
      stepNumber: 8,
      label: "First tenderness check",
      durationSeconds: 9000,
      recommendation: "recommended",
      cue: "Test one rib after 2½ hours and continue braising if resistant."
    },
    {
      stepNumber: 10,
      label: "Sauce reduction check",
      durationSeconds: 600,
      recommendation: "optional",
      cue: "Check whether the sauce lightly coats a spoon."
    }
  ],
  isFeatured: false
};

const frenchOmelette: Recipe = {
  id: "french-omelette",
  title: "French Omelette",
  description: "A soft, pale omelette with delicate curds and a classic rolled shape.",
  totalTime: "10 minutes",
  difficulty: "Technique-focused",
  technique: "Gentle heat and continuous movement",
  ingredients: [
    { amount: "3 large", name: "eggs" },
    { amount: "1 pinch", name: "kosher salt" },
    { amount: "1½ tbsp", name: "unsalted butter", preparation: "divided" },
    { amount: "1 tsp", name: "chives", preparation: "finely sliced; optional" }
  ],
  steps: [
    {
      number: 1,
      title: "Whisk completely.",
      instruction: "Crack and thoroughly whisk the eggs.",
      detail: "Blend the yolks and whites until no white streaks remain without whipping in lots of air.",
      safety: "Wash your hands and clean any surface touched by raw egg."
    },
    {
      number: 2,
      title: "Melt the butter.",
      instruction: "Melt butter over low to medium-low heat.",
      detail: "Use a small nonstick pan; the butter should foam gently without browning."
    },
    {
      number: 3,
      title: "Begin stirring.",
      instruction: "Add the eggs and stir continuously.",
      detail: "Scrape the base and sides with small, fast motions so nothing sets into a large sheet."
    },
    {
      number: 4,
      title: "Form tiny curds.",
      instruction: "Shake the pan while forming very small curds.",
      detail: "Keep the eggs moving until they resemble loose, fine cottage cheese."
    },
    {
      number: 5,
      title: "Stop at glossy.",
      instruction: "Stop stirring while the surface is still slightly wet.",
      detail: "Remove the pan from heat if the curds are setting faster than you can control."
    },
    {
      number: 6,
      title: "Smooth the surface.",
      instruction: "Smooth the eggs into an even layer.",
      detail: "Use the spatula gently so the underside stays pale and the center remains soft."
    },
    {
      number: 7,
      title: "Roll neatly.",
      instruction: "Fold and roll the omelette.",
      detail: "Fold the edge nearest the handle inward, then tip and guide the omelette toward the far rim."
    },
    {
      number: 8,
      title: "Turn it out.",
      instruction: "Turn it onto the plate seam-side down.",
      detail: "Hold the plate close to the pan and use one confident turning motion."
    },
    {
      number: 9,
      title: "Finish and serve.",
      instruction: "Brush lightly with butter and serve immediately.",
      detail: "Tuck the ends underneath and add chives if using."
    }
  ],
  visualCheckpoints: [
    {
      stepNumber: 2,
      question: "Is my pan too hot?",
      guidance: "The butter should foam quietly and remain pale.",
      immediateAction: "Lift the pan off the burner and lower the heat if the butter browns."
    },
    {
      stepNumber: 4,
      question: "Are the curds too large?",
      guidance: "The curds should be very small and softly set.",
      immediateAction: "Stir faster with smaller motions while shaking the pan."
    },
    {
      stepNumber: 5,
      question: "Should I stop stirring?",
      guidance: "Stop when the eggs hold together but the top still looks glossy, with no loose puddle.",
      immediateAction: "Take the pan off heat now if the surface is becoming matte."
    },
    {
      stepNumber: 7,
      question: "How do I roll it?",
      guidance: "The egg layer should slide freely and fold without cracking.",
      immediateAction: "Loosen the edges, fold the near edge inward, then tip the pan away."
    }
  ],
  safetyNotes: [
    { stepNumber: 1, text: "Prevent cross-contamination from raw egg." },
    {
      stepNumber: 5,
      text: "A soft omelette may contain lightly cooked egg; use pasteurized eggs for higher-risk diners."
    },
    { stepNumber: 9, text: "Serve promptly instead of holding the soft omelette at room temperature." }
  ],
  suggestedTimers: [
    {
      stepNumber: 4,
      label: "Small-curd check",
      durationSeconds: 30,
      recommendation: "optional",
      cue: "Use texture rather than the clock as the final signal."
    }
  ],
  isFeatured: false
};

const roastChicken: Recipe = {
  id: "roast-chicken",
  title: "Roast Chicken",
  description: "A simple whole roast chicken with crisp skin, herbs, garlic, and pan juices.",
  totalTime: "1 hour 30 minutes",
  difficulty: "Approachable",
  technique: "Roasting",
  ingredients: [
    { amount: "1", name: "whole chicken", preparation: "about 4 to 4½ lb" },
    { amount: "2 tsp", name: "kosher salt" },
    { amount: "1 tsp", name: "black pepper", preparation: "freshly ground" },
    { amount: "2 tbsp", name: "unsalted butter", preparation: "softened" },
    { amount: "1 head", name: "garlic", preparation: "halved crosswise" },
    { amount: "1", name: "lemon", preparation: "halved" },
    { amount: "6 sprigs", name: "thyme" },
    { amount: "2 sprigs", name: "rosemary" }
  ],
  steps: [
    {
      number: 1,
      title: "Dry the chicken.",
      instruction: "Pat the chicken completely dry.",
      detail: "Preheat the oven to 425°F, then blot the skin and cavity thoroughly with paper towel.",
      safety: "Do not rinse raw chicken. Wash your hands and sanitize contacted surfaces."
    },
    {
      number: 2,
      title: "Season thoroughly.",
      instruction: "Season inside and out with salt and pepper.",
      detail: "Spread softened butter over the skin, then distribute the seasoning evenly."
    },
    {
      number: 3,
      title: "Fill the cavity.",
      instruction: "Add garlic, lemon, and herbs to the cavity.",
      detail: "Keep the aromatics loose rather than packing the cavity tightly."
    },
    {
      number: 4,
      title: "Secure the legs.",
      instruction: "Truss the legs if desired.",
      detail: "Use a simple loop of kitchen twine and leave the breast exposed to the oven heat."
    },
    {
      number: 5,
      title: "Set the bird.",
      instruction: "Place the chicken in a roasting pan or oven-safe skillet.",
      detail: "Set it breast-side up and tuck the wing tips underneath."
    },
    {
      number: 6,
      title: "Roast until golden.",
      instruction: "Roast until deeply golden.",
      detail: "Begin checking after 50 minutes and rotate the pan if one side colors much faster.",
      safety: "Color alone cannot confirm that chicken is safely cooked."
    },
    {
      number: 7,
      title: "Check the temperature.",
      instruction: "Check the temperature in the thickest part of the thigh without touching bone.",
      detail: "Verify the thickest breast as well; both locations must reach at least 165°F.",
      safety: "Do not confirm doneness without a thermometer reading of at least 165°F."
    },
    {
      number: 8,
      title: "Rest the chicken.",
      instruction: "Rest before carving.",
      detail: "Leave the chicken uncovered or loosely tented for 15 minutes so the skin stays crisp.",
      safety: "The pan and collected juices remain very hot."
    },
    {
      number: 9,
      title: "Finish and serve.",
      instruction: "Spoon over the pan juices and serve.",
      detail: "Carve the rested chicken and taste the juices for seasoning before spooning them over."
    }
  ],
  visualCheckpoints: [
    {
      stepNumber: 1,
      question: "Is the skin dry enough?",
      guidance: "The surface should look matte with no visible beads of moisture around joints or folds.",
      immediateAction: "Blot damp areas again with a clean paper towel."
    },
    {
      stepNumber: 7,
      question: "Where should I place the thermometer?",
      guidance: "Aim for the thickest inner thigh without touching bone, then check the thickest breast.",
      immediateAction: "Reposition the probe if it touches bone or sits in the cavity.",
      requiresMeasurement: true
    },
    {
      stepNumber: 6,
      question: "Is the skin getting too dark?",
      guidance: "Deep amber is desirable; blackening patches indicate excessive browning.",
      immediateAction: "Loosely shield the dark area with foil while the chicken finishes."
    },
    {
      stepNumber: 8,
      question: "How long should it rest?",
      guidance: "A 4 to 4½ pound chicken should rest for about 15 minutes.",
      immediateAction: "Keep resting until the timer finishes.",
      requiresMeasurement: true
    }
  ],
  safetyNotes: [
    { stepNumber: 1, text: "Do not rinse raw poultry; prevent cross-contamination." },
    { stepNumber: 6, text: "Skin color cannot establish poultry doneness." },
    {
      stepNumber: 7,
      text: "Require an internal thermometer reading of at least 165°F before confirming doneness."
    },
    { stepNumber: 8, text: "Use care around the hot roasting pan and pan juices." }
  ],
  suggestedTimers: [
    {
      stepNumber: 6,
      label: "First chicken temperature check",
      durationSeconds: 3000,
      recommendation: "recommended",
      cue: "Check the thigh and breast after 50 minutes; continue roasting if either is below 165°F."
    },
    {
      stepNumber: 8,
      label: "Chicken rest",
      durationSeconds: 900,
      recommendation: "recommended",
      cue: "Carve when the 15-minute rest is complete."
    }
  ],
  isFeatured: false
};

const pastaCarbonara: Recipe = {
  id: "pasta-carbonara",
  title: "Pasta Carbonara",
  description: "Spaghetti coated with eggs, Pecorino Romano, black pepper, and crisp guanciale.",
  totalTime: "25 minutes",
  difficulty: "Intermediate",
  technique: "Emulsification",
  ingredients: [
    { amount: "12 oz", name: "spaghetti" },
    { amount: "6 oz", name: "guanciale", preparation: "cut into short strips" },
    { amount: "2 large", name: "eggs" },
    { amount: "4 large", name: "egg yolks" },
    {
      amount: "1 cup",
      name: "Pecorino Romano",
      preparation: "finely grated, plus more to finish"
    },
    {
      amount: "2 tsp",
      name: "black pepper",
      preparation: "freshly ground, plus more to finish"
    },
    { amount: "as needed", name: "kosher salt" }
  ],
  steps: [
    {
      number: 1,
      title: "Boil the water.",
      instruction: "Bring a pot of salted water to a boil.",
      detail: "Salt moderately because the guanciale and Pecorino are already salty.",
      safety: "Keep the pot handle secure and take care around boiling water and steam."
    },
    {
      number: 2,
      title: "Render the guanciale.",
      instruction: "Cut the guanciale and cook it slowly until crisp.",
      detail: "Start in a cool skillet over medium-low heat so the fat renders before the edges brown."
    },
    {
      number: 3,
      title: "Mix the eggs.",
      instruction: "Whisk eggs, grated Pecorino Romano, and black pepper.",
      detail: "Mix until thick and smooth with no dry pockets of cheese.",
      safety: "Wash your hands and clean any surface touched by raw egg."
    },
    {
      number: 4,
      title: "Undercook the pasta.",
      instruction: "Cook the pasta until just shy of al dente.",
      detail: "Use the package time as a guide and begin tasting about two minutes early."
    },
    {
      number: 5,
      title: "Save the water.",
      instruction: "Reserve plenty of pasta water.",
      detail: "Scoop out about two cups before draining so the starchy water is ready for the sauce.",
      safety: "Pasta water can cause serious burns; scoop it carefully."
    },
    {
      number: 6,
      title: "Combine off heat.",
      instruction: "Add the pasta to the guanciale and remove the pan from direct heat.",
      detail: "Toss until the strands are coated in rendered fat, then move the pan completely off the burner."
    },
    {
      number: 7,
      title: "Add the egg mixture.",
      instruction: "Add the egg and cheese mixture.",
      detail: "Keep the pan off direct heat and spread the mixture across the pasta rather than one hot spot.",
      safety: "The pan must remain off direct heat so the eggs emulsify instead of scrambling."
    },
    {
      number: 8,
      title: "Build the emulsion.",
      instruction: "Toss quickly while adding small amounts of pasta water.",
      detail: "Keep the pasta moving and add only enough water to make the sauce flow."
    },
    {
      number: 9,
      title: "Adjust the texture.",
      instruction: "Continue tossing until glossy and creamy.",
      detail: "Add pasta water a tablespoon at a time if the sauce tightens; use residual warmth, not direct heat."
    },
    {
      number: 10,
      title: "Finish immediately.",
      instruction: "Finish with more cheese and black pepper.",
      detail: "Serve at once while the sauce is loose and glossy."
    }
  ],
  visualCheckpoints: [
    {
      stepNumber: 2,
      question: "Is the guanciale ready?",
      guidance: "The pieces should have crisp amber edges with rendered, slightly tender centers.",
      immediateAction: "Keep cooking gently if the fat is still opaque and the edges are pale."
    },
    {
      stepNumber: 7,
      question: "Is the pan too hot for the eggs?",
      guidance: "Aggressive sizzling or visible smoking means the pan is too hot.",
      immediateAction: "Keep it off heat and wait until the sizzling settles before adding the mixture."
    },
    {
      stepNumber: 8,
      question: "Why is my sauce clumping?",
      guidance: "Clumps usually indicate excess heat or too little pasta water.",
      immediateAction: "Keep the pan off heat, add a small splash of pasta water, and toss vigorously."
    },
    {
      stepNumber: 9,
      question: "Is the sauce too thick?",
      guidance: "The sauce should flow around the strands instead of sitting in paste-like clumps.",
      immediateAction: "Add warm pasta water one tablespoon at a time while tossing."
    }
  ],
  safetyNotes: [
    { stepNumber: 1, text: "Use care around boiling water and steam." },
    { stepNumber: 3, text: "Prevent cross-contamination from raw egg." },
    { stepNumber: 6, text: "Move the pan completely off direct heat before adding eggs." },
    {
      stepNumber: 7,
      text: "Keep the pan off direct heat; use pasteurized eggs for higher-risk diners."
    }
  ],
  suggestedTimers: [
    {
      stepNumber: 2,
      label: "Guanciale crispness check",
      durationSeconds: 420,
      recommendation: "recommended",
      cue: "Check after seven minutes; visual texture remains the final signal."
    },
    {
      stepNumber: 7,
      label: "Hot-pan settling check",
      durationSeconds: 20,
      recommendation: "optional",
      cue: "Use only if the pan is still aggressively sizzling after leaving the heat."
    }
  ],
  isFeatured: false
};

export const recipes: Recipe[] = [
  steakAuPoivre,
  redWineBraisedShortRibs,
  frenchOmelette,
  roastChicken,
  pastaCarbonara
];

export const featuredRecipe = steakAuPoivre;

// Kept as a compatibility alias while the cooking UI migrates to selected recipes.
export const recipe = featuredRecipe;
export const TOTAL_STEPS = featuredRecipe.steps.length;

export function getRecipeById(id: string): Recipe | undefined {
  return recipes.find((candidate) => candidate.id === id);
}

export function getRecipeStep(selectedRecipe: Recipe, stepNumber: number): RecipeStep;
export function getRecipeStep(stepNumber: number): RecipeStep;
export function getRecipeStep(
  recipeOrStep: Recipe | number,
  maybeStepNumber?: number
): RecipeStep {
  const selectedRecipe = typeof recipeOrStep === "number" ? featuredRecipe : recipeOrStep;
  const requestedStep = typeof recipeOrStep === "number" ? recipeOrStep : maybeStepNumber ?? 1;
  const normalizedStep = Number.isFinite(requestedStep) ? Math.round(requestedStep) : 1;
  const clampedStep = Math.min(Math.max(normalizedStep, 1), selectedRecipe.steps.length);
  return selectedRecipe.steps[clampedStep - 1];
}

export function getRelevantSafetyNotes(
  selectedRecipe: Recipe,
  stepNumber: number
): SafetyNote[] {
  const currentStep = getRecipeStep(selectedRecipe, stepNumber).number;
  return selectedRecipe.safetyNotes.filter(
    (note) => note.stepNumber === undefined || note.stepNumber === currentStep
  );
}

export function getSuggestedTimers(
  selectedRecipe: Recipe,
  stepNumber: number
): SuggestedTimer[] {
  const currentStep = getRecipeStep(selectedRecipe, stepNumber).number;
  return selectedRecipe.suggestedTimers.filter((timer) => timer.stepNumber === currentStep);
}

export function getVisualCheckpoint(
  selectedRecipe: Recipe,
  stepNumber: number
): VisualCheckpoint | undefined {
  const currentStep = getRecipeStep(selectedRecipe, stepNumber).number;
  return selectedRecipe.visualCheckpoints.find(
    (checkpoint) => checkpoint.stepNumber === currentStep
  );
}
