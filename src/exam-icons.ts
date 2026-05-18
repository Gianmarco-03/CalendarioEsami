import {
  // Lettere & studio
  BookOpen, Book, BookMarked, BookOpenText, Library,
  ScrollText, Scroll, Notebook, NotebookPen, FileText,
  Feather, PenTool, Pencil, Quote, Type, Newspaper,
  GraduationCap, School,
  // Cognitivo
  Brain, BrainCircuit, Lightbulb, Eye, Ear,
  // Lingue
  Languages,
  // Matematica & logica
  Calculator, Sigma, Pi, Infinity, Percent, Divide,
  Hexagon, Triangle, Square, Circle, Hourglass,
  // Fisica
  Atom, Magnet, Zap, Waves, Thermometer, Telescope, Rocket,
  // Chimica
  FlaskConical, FlaskRound, TestTube, TestTubes, Beaker,
  // Biologia / natura
  Dna, Microscope, Leaf, Sprout, Flower, Trees, Fish, Bird,
  // Medicina
  Stethoscope, Pill, Heart, HeartPulse, Syringe, Bone, Activity, Baby,
  // Informatica
  Code, Cpu, Terminal, Database, Server, Monitor, Bug,
  Keyboard, Smartphone, HardDrive,
  // Geografia & meteo
  Globe, Map, MapPin, Compass, Mountain,
  Sun, Moon, Cloud, Wind, Droplet, Flame, Snowflake,
  // Diritto & economia
  Scale, Gavel, Briefcase, Coins, DollarSign, Euro,
  BarChart3, PieChart, TrendingUp, LineChart,
  // Arte
  Palette, Brush, Image, Camera, Film,
  // Musica
  Music, Guitar, Piano, Drum, Mic, Headphones,
  // Sport
  Dumbbell, Bike, Trophy, Award, Target, Flag, Star,
  // Strumenti
  Hammer, Wrench, Ruler, Wand, WandSparkles,
  type LucideIcon,
} from "lucide-react";

/** Slug delle 10 icone "featured", mostrate sempre prima dell'espansione. */
export const FEATURED_ICON_SLUGS = new Set<string>([
  "book-open",
  "brain",
  "atom",
  "flask-conical",
  "dna",
  "stethoscope",
  "calculator",
  "code",
  "globe",
  "scale",
]);

export const EXAM_ICONS: { slug: string; label: string; Icon: LucideIcon }[] = [
  // — Lettere & studio
  { slug: "book-open",        label: "Libro aperto",  Icon: BookOpen },
  { slug: "book",             label: "Libro",         Icon: Book },
  { slug: "book-marked",      label: "Segnalibro",    Icon: BookMarked },
  { slug: "book-open-text",   label: "Testo",         Icon: BookOpenText },
  { slug: "library",          label: "Biblioteca",    Icon: Library },
  { slug: "scroll-text",      label: "Pergamena",     Icon: ScrollText },
  { slug: "scroll",           label: "Rotolo",        Icon: Scroll },
  { slug: "notebook",         label: "Quaderno",      Icon: Notebook },
  { slug: "notebook-pen",     label: "Appunti",       Icon: NotebookPen },
  { slug: "file-text",        label: "Documento",     Icon: FileText },
  { slug: "feather",          label: "Letteratura",   Icon: Feather },
  { slug: "pen-tool",         label: "Penna",         Icon: PenTool },
  { slug: "pencil",           label: "Matita",        Icon: Pencil },
  { slug: "quote",            label: "Citazione",     Icon: Quote },
  { slug: "type",             label: "Tipografia",    Icon: Type },
  { slug: "newspaper",        label: "Giornalismo",   Icon: Newspaper },
  { slug: "graduation-cap",   label: "Laurea",        Icon: GraduationCap },
  { slug: "school",           label: "Scuola",        Icon: School },

  // — Cognitivo
  { slug: "brain",            label: "Cervello",      Icon: Brain },
  { slug: "brain-circuit",    label: "Cognitivo",     Icon: BrainCircuit },
  { slug: "lightbulb",        label: "Idea",          Icon: Lightbulb },
  { slug: "eye",              label: "Visione",       Icon: Eye },
  { slug: "ear",              label: "Udito",         Icon: Ear },

  // — Lingue
  { slug: "languages",        label: "Lingue",        Icon: Languages },

  // — Matematica & logica
  { slug: "calculator",       label: "Matematica",    Icon: Calculator },
  { slug: "sigma",            label: "Statistica",    Icon: Sigma },
  { slug: "pi",               label: "Analisi",       Icon: Pi },
  { slug: "infinity",         label: "Infinito",      Icon: Infinity },
  { slug: "percent",          label: "Probabilità",   Icon: Percent },
  { slug: "divide",           label: "Aritmetica",    Icon: Divide },
  { slug: "hexagon",          label: "Geometria",     Icon: Hexagon },
  { slug: "triangle",         label: "Triangolo",     Icon: Triangle },
  { slug: "square",           label: "Quadrato",      Icon: Square },
  { slug: "circle",           label: "Cerchio",       Icon: Circle },
  { slug: "hourglass",        label: "Logica",        Icon: Hourglass },

  // — Fisica
  { slug: "atom",             label: "Fisica",        Icon: Atom },
  { slug: "magnet",           label: "Magnetismo",    Icon: Magnet },
  { slug: "zap",              label: "Elettricità",   Icon: Zap },
  { slug: "waves",            label: "Onde",          Icon: Waves },
  { slug: "thermometer",      label: "Termodinamica", Icon: Thermometer },
  { slug: "telescope",        label: "Astronomia",    Icon: Telescope },
  { slug: "rocket",           label: "Astrofisica",   Icon: Rocket },

  // — Chimica
  { slug: "flask-conical",    label: "Chimica",       Icon: FlaskConical },
  { slug: "flask-round",      label: "Soluzione",     Icon: FlaskRound },
  { slug: "test-tube",        label: "Provetta",      Icon: TestTube },
  { slug: "test-tubes",       label: "Laboratorio",   Icon: TestTubes },
  { slug: "beaker",           label: "Becher",        Icon: Beaker },

  // — Biologia / natura
  { slug: "dna",              label: "Biologia",      Icon: Dna },
  { slug: "microscope",       label: "Microbiologia", Icon: Microscope },
  { slug: "leaf",             label: "Botanica",      Icon: Leaf },
  { slug: "sprout",           label: "Germoglio",     Icon: Sprout },
  { slug: "flower",           label: "Fiore",         Icon: Flower },
  { slug: "trees",            label: "Ecologia",      Icon: Trees },
  { slug: "fish",             label: "Ittiologia",    Icon: Fish },
  { slug: "bird",             label: "Ornitologia",   Icon: Bird },

  // — Medicina
  { slug: "stethoscope",      label: "Clinica",       Icon: Stethoscope },
  { slug: "pill",             label: "Farmacologia",  Icon: Pill },
  { slug: "heart",            label: "Cardiologia",   Icon: Heart },
  { slug: "heart-pulse",      label: "Cardiopatia",   Icon: HeartPulse },
  { slug: "syringe",          label: "Vaccinologia",  Icon: Syringe },
  { slug: "bone",             label: "Ortopedia",     Icon: Bone },
  { slug: "activity",         label: "Fisiologia",    Icon: Activity },
  { slug: "baby",             label: "Pediatria",     Icon: Baby },

  // — Informatica
  { slug: "code",             label: "Programmazione", Icon: Code },
  { slug: "cpu",              label: "Architetture",  Icon: Cpu },
  { slug: "terminal",         label: "Sistemi",       Icon: Terminal },
  { slug: "database",         label: "Basi di dati",  Icon: Database },
  { slug: "server",           label: "Reti",          Icon: Server },
  { slug: "monitor",          label: "HCI",           Icon: Monitor },
  { slug: "bug",              label: "Testing",       Icon: Bug },
  { slug: "keyboard",         label: "Tastiera",      Icon: Keyboard },
  { slug: "smartphone",       label: "Mobile",        Icon: Smartphone },
  { slug: "hard-drive",       label: "Storage",       Icon: HardDrive },

  // — Geografia & meteo
  { slug: "globe",            label: "Geografia",     Icon: Globe },
  { slug: "map",              label: "Cartografia",   Icon: Map },
  { slug: "map-pin",          label: "Topografia",    Icon: MapPin },
  { slug: "compass",          label: "Orientamento",  Icon: Compass },
  { slug: "mountain",         label: "Geologia",      Icon: Mountain },
  { slug: "sun",              label: "Sole",          Icon: Sun },
  { slug: "moon",             label: "Luna",          Icon: Moon },
  { slug: "cloud",            label: "Meteorologia",  Icon: Cloud },
  { slug: "wind",             label: "Vento",         Icon: Wind },
  { slug: "droplet",          label: "Idrologia",     Icon: Droplet },
  { slug: "flame",            label: "Combustione",   Icon: Flame },
  { slug: "snowflake",        label: "Glaciologia",   Icon: Snowflake },

  // — Diritto & economia
  { slug: "scale",            label: "Diritto",       Icon: Scale },
  { slug: "gavel",            label: "Giurisprudenza", Icon: Gavel },
  { slug: "briefcase",        label: "Economia",      Icon: Briefcase },
  { slug: "coins",            label: "Monete",        Icon: Coins },
  { slug: "dollar-sign",      label: "Finanza",       Icon: DollarSign },
  { slug: "euro",             label: "Euro",          Icon: Euro },
  { slug: "bar-chart-3",      label: "Statistiche",   Icon: BarChart3 },
  { slug: "pie-chart",        label: "Dati",          Icon: PieChart },
  { slug: "trending-up",      label: "Mercati",       Icon: TrendingUp },
  { slug: "line-chart",       label: "Andamento",     Icon: LineChart },

  // — Arte & musica
  { slug: "palette",          label: "Arte",          Icon: Palette },
  { slug: "brush",            label: "Pittura",       Icon: Brush },
  { slug: "image",            label: "Storia dell'arte", Icon: Image },
  { slug: "camera",           label: "Fotografia",    Icon: Camera },
  { slug: "film",             label: "Cinema",        Icon: Film },
  { slug: "music",            label: "Musica",        Icon: Music },
  { slug: "guitar",           label: "Chitarra",      Icon: Guitar },
  { slug: "piano",            label: "Pianoforte",    Icon: Piano },
  { slug: "drum",             label: "Percussioni",   Icon: Drum },
  { slug: "mic",              label: "Canto",         Icon: Mic },
  { slug: "headphones",       label: "Audio",         Icon: Headphones },

  // — Sport
  { slug: "dumbbell",         label: "Allenamento",   Icon: Dumbbell },
  { slug: "bike",             label: "Ciclismo",      Icon: Bike },
  { slug: "trophy",           label: "Trofeo",        Icon: Trophy },
  { slug: "award",            label: "Premio",        Icon: Award },
  { slug: "target",           label: "Obiettivo",     Icon: Target },
  { slug: "flag",             label: "Bandiera",      Icon: Flag },
  { slug: "star",             label: "Stella",        Icon: Star },

  // — Strumenti
  { slug: "hammer",           label: "Ingegneria",    Icon: Hammer },
  { slug: "wrench",           label: "Meccanica",     Icon: Wrench },
  { slug: "ruler",            label: "Disegno",       Icon: Ruler },
  { slug: "wand",             label: "Bacchetta",     Icon: Wand },
  { slug: "wand-sparkles",    label: "Magia",         Icon: WandSparkles },
];

export const DEFAULT_ICON_SLUG = "book-open";

const ICON_BY_SLUG: Record<string, LucideIcon> = Object.fromEntries(
  EXAM_ICONS.map((e) => [e.slug, e.Icon]),
);

export function iconFor(slug: string | undefined | null): LucideIcon {
  if (!slug) return BookOpen;
  return ICON_BY_SLUG[slug] ?? BookOpen;
}
