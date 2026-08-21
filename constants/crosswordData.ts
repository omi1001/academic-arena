export interface CrosswordPack {
  id: string;
  root: string;
  category: 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics' | 'General Science';
  hint: string;
  gridWords: string[];
  bonusWords: string[];
}

export const ACADEMIC_CROSSWORD_PACKS: CrosswordPack[] = [
  // ─── 🔬 PHYSICS ───
  {
    id: 'pack_prism',
    root: 'PRISM',
    category: 'Physics',
    hint: 'A triangular glass optical device that disperses white light into a rainbow spectrum.',
    gridWords: ['PRISM', 'RIMS', 'RIPS', 'SIR', 'RIP', 'SIM'],
    bonusWords: ['IMP', 'MIS', 'PRIM', 'PIS'],
  },
  {
    id: 'pack_optics',
    root: 'OPTICS',
    category: 'Physics',
    hint: 'The branch of physics that studies the behavior and properties of light.',
    gridWords: ['OPTICS', 'TOPIC', 'POST', 'STOP', 'SPOT', 'TOP', 'OPT', 'PIT', 'TIP', 'SIT'],
    bonusWords: ['POTS', 'TOPS', 'SPIT', 'TICS', 'SCOT', 'PICS', 'COP', 'COT', 'POT', 'SOP'],
  },
  {
    id: 'pack_vector',
    root: 'VECTOR',
    category: 'Physics',
    hint: 'A physical quantity that has both magnitude and direction.',
    gridWords: ['VECTOR', 'COVER', 'COVE', 'CORE', 'VOTE', 'ROTE', 'TORE', 'ROVE', 'VET', 'ROE'],
    bonusWords: ['OVER', 'CERT', 'TORE', 'ECO', 'REC', 'COT', 'ROT', 'TOR', 'ORE'],
  },
  {
    id: 'pack_newton',
    root: 'NEWTON',
    category: 'Physics',
    hint: 'The SI unit of force, named after the legendary English physicist.',
    gridWords: ['NEWTON', 'TOWN', 'WENT', 'NOTE', 'TONE', 'WET', 'NET', 'TEN', 'NOT', 'TON', 'NOW', 'WON'],
    bonusWords: ['OWE', 'NEW', 'TOE', 'EON', 'TWO', 'OWN'],
  },
  {
    id: 'pack_energy',
    root: 'ENERGY',
    category: 'Physics',
    hint: 'The quantitative property that is transferred to a body to perform work.',
    gridWords: ['ENERGY', 'GENRE', 'GREEN', 'GREY', 'EYRE', 'GYRE', 'GEN', 'EYE'],
    bonusWords: ['EGG', 'ERG', 'NEE', 'ERE'],
  },
  {
    id: 'pack_magnet',
    root: 'MAGNET',
    category: 'Physics',
    hint: 'A material that produces a magnetic field attracting iron and nickel.',
    gridWords: ['MAGNET', 'AGENT', 'MEANT', 'MATE', 'NEAT', 'GATE', 'GAME', 'TEAM', 'NAME', 'MAN', 'NET', 'TAG'],
    bonusWords: ['TAME', 'MEGA', 'META', 'MAGE', 'GNAW', 'ANTE', 'GEM', 'EAT', 'TEA', 'MET', 'GET', 'TEN', 'MAT', 'ANT'],
  },
  {
    id: 'pack_motion',
    root: 'MOTION',
    category: 'Physics',
    hint: 'The phenomenon in which an object changes its position with respect to time.',
    gridWords: ['MOTION', 'MOON', 'INTO', 'MINT', 'OINT', 'NOT', 'TON', 'TOO', 'ION', 'MOO'],
    bonusWords: ['OOT', 'MOT', 'NIT', 'TIN', 'TOM'],
  },

  // ─── 🧪 CHEMISTRY ───
  {
    id: 'pack_proton',
    root: 'PROTON',
    category: 'Chemistry',
    hint: 'A stable subatomic particle occurring in all atomic nuclei with a positive electric charge.',
    gridWords: ['PROTON', 'ROOP', 'POOR', 'PORT', 'ROOT', 'TOON', 'TOP', 'OPT', 'NOT', 'TON', 'POT', 'ROT', 'TOO'],
    bonusWords: ['POOT', 'TROOP', 'ROOF', 'PRO', 'ROO', 'TOR'],
  },
  {
    id: 'pack_carbon',
    root: 'CARBON',
    category: 'Chemistry',
    hint: 'A versatile tetravalent non-metallic chemical element essential to all organic life.',
    gridWords: ['CARBON', 'BARON', 'BACON', 'BARN', 'CRAB', 'BORN', 'CORN', 'ROAN', 'CAN', 'CAB', 'BAN', 'BAR', 'CAR', 'OAR', 'ROB'],
    bonusWords: ['BRAN', 'COB', 'CON', 'ARC', 'RAN', 'NOR', 'BOA', 'BRA'],
  },
  {
    id: 'pack_valency',
    root: 'VALENCY',
    category: 'Chemistry',
    hint: 'The combining capacity of an atom or radical determined by its valence electrons.',
    gridWords: ['VALENCY', 'CLAY', 'LANE', 'VALE', 'VEAL', 'LACE', 'ACNE', 'CAN', 'VAN', 'ANY', 'NAY'],
    bonusWords: ['CLEAN', 'LEAN', 'CANE', 'CAVE', 'YEA', 'ALE', 'LAY'],
  },
  {
    id: 'pack_metals',
    root: 'METALS',
    category: 'Chemistry',
    hint: 'Elements characterized by high electrical and thermal conductivity, luster, and malleability.',
    gridWords: ['METALS', 'STALE', 'STEAM', 'TAMES', 'MEAT', 'MELT', 'TALE', 'LATE', 'MATE', 'TEAM', 'SEAM', 'SALT', 'LAST', 'EAT', 'TEA', 'MAT', 'SET', 'LET'],
    bonusWords: ['MALTS', 'LAMST', 'MEATS', 'SEAL', 'STEM', 'SLAT', 'MALT', 'MAST', 'ALE', 'MET', 'SEA'],
  },
  {
    id: 'pack_oxygen',
    root: 'OXYGEN',
    category: 'Chemistry',
    hint: 'A highly reactive diatomic gas that makes up roughly 21% of Earth’s atmosphere.',
    gridWords: ['OXYGEN', 'EGO', 'GYO', 'ONE', 'YEN', 'EON'],
    bonusWords: ['GOX', 'OXY', 'GEN'],
  },

  // ─── 🧬 BIOLOGY ───
  {
    id: 'pack_cells',
    root: 'CELLS',
    category: 'Biology',
    hint: 'The basic structural, functional, and biological unit of all known living organisms.',
    gridWords: ['CELLS', 'CELL', 'SELL', 'ELLS', 'SEE', 'EEL'],
    bonusWords: ['ELSE', 'LES', 'ELS'],
  },
  {
    id: 'pack_neuron',
    root: 'NEURON',
    category: 'Biology',
    hint: 'An electrically excitable cell that communicates with other cells via synapses.',
    gridWords: ['NEURON', 'RUN', 'ONE', 'EON', 'NOR', 'OUR', 'NUN'],
    bonusWords: ['NONE', 'NOUN', 'RUE', 'URN', 'NEO'],
  },
  {
    id: 'pack_tissue',
    root: 'TISSUE',
    category: 'Biology',
    hint: 'An ensemble of similar cells from the same origin that together carry out a specific function.',
    gridWords: ['TISSUE', 'SUITE', 'SUIT', 'SITE', 'SUET', 'TIES', 'USE', 'SIT', 'SET', 'TIE'],
    bonusWords: ['TUTS', 'SETS', 'SUE', 'ITS'],
  },
  {
    id: 'pack_genome',
    root: 'GENOME',
    category: 'Biology',
    hint: 'The complete set of genetic information in an organism, stored as DNA or RNA.',
    gridWords: ['GENOME', 'GENE', 'GONE', 'MENO', 'OGEE', 'GEM', 'EGO', 'MEN', 'ONE', 'EON'],
    bonusWords: ['GNE', 'NEE', 'EGG'],
  },

  // ─── 📐 MATHEMATICS ───
  {
    id: 'pack_sphere',
    root: 'SPHERE',
    category: 'Mathematics',
    hint: 'A perfectly round geometrical 3D object where every surface point is equidistant from the center.',
    gridWords: ['SPHERE', 'SHEEP', 'SHEER', 'PEERS', 'SPREE', 'HERE', 'PEER', 'SEEP', 'SEER', 'HER', 'SEE', 'PER', 'SHE'],
    bonusWords: ['PREE', 'EPH', 'REP', 'PEE'],
  },
  {
    id: 'pack_radius',
    root: 'RADIUS',
    category: 'Mathematics',
    hint: 'A straight line from the center to the circumference of a circle or surface of a sphere.',
    gridWords: ['RADIUS', 'RAIDS', 'ARID', 'RAID', 'SAID', 'SURD', 'AIR', 'SIR', 'SUD'],
    bonusWords: ['RIDS', 'URSA', 'RAD', 'RID'],
  },
  {
    id: 'pack_linear',
    root: 'LINEAR',
    category: 'Mathematics',
    hint: 'An algebraic equation or geometric curve that can be represented as a straight line.',
    gridWords: ['LINEAR', 'LEARN', 'ALIEN', 'LINE', 'LANE', 'EARN', 'NEAR', 'RAIN', 'RAIL', 'LIAR', 'EAR', 'ERA', 'AIR', 'RAN'],
    bonusWords: ['LAIN', 'LEAN', 'LIRE', 'ALE', 'LIE', 'NIL', 'IRE'],
  },
  {
    id: 'pack_matrix',
    root: 'MATRIX',
    category: 'Mathematics',
    hint: 'A rectangular array or table of numbers, symbols, or expressions arranged in rows and columns.',
    gridWords: ['MATRIX', 'RAMI', 'TRIM', 'TAXI', 'AIR', 'ARM', 'ART', 'MAT', 'RAM', 'RAT', 'TAR', 'TAX', 'MAX', 'MIX', 'RIM'],
    bonusWords: ['MART', 'TRAM', 'AMIR', 'AIM', 'MAR', 'TAM', 'RAX'],
  },
];
