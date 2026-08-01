/* AUTO-COPIED from the design system. DO NOT EDIT HERE.
   Source: design/src/icons.ts
   Change it there, then run: npm run sync -- <app>
   Check every app for drift with: npm run check:drift */

/* =========================================================================
   L2 - The core icon set.

   Lucide everywhere, never emoji.

   WHY THIS IS A CORE SET AND NOT THE WHOLE CATALOG
   A single registry holding every icon any app might want would hold a live
   reference to all of them, which defeats tree-shaking: every app would ship
   every icon. These are mobile-first PWAs, so that cost is real. Instead the
   kit ships the ~50 icons that genuinely recur across all nine apps, and each
   app extends the registry with its own domain icons via createIcon().

   The set below was chosen from what the apps actually import today (counted
   across Plate, Tally, lock-in and Budgetly), not from guesswork.

     import { createIcon } from "@/_design/Icon";
     import { coreIcons } from "@/_design/icons";
     import { Beef, Carrot } from "lucide-react";

     export const Icon = createIcon({ ...coreIcons, beef: Beef, carrot: Carrot });

   Names are semantic and kebab-case ("delete", not "Trash2") so the meaning
   survives an icon swap. Values stay plain strings in app catalogs, which is
   what keeps quest/badge data serializable across the RSC boundary.
   ========================================================================= */

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Flame,
  Heart,
  Home,
  Image,
  Info,
  Loader2,
  LogOut,
  Menu,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  Tag,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  User,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const coreIcons = {
  // --- Navigation and chrome ---
  home: Home,
  menu: Menu,
  close: X,
  back: ChevronLeft,
  forward: ChevronRight,
  up: ChevronUp,
  down: ChevronDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  more: MoreHorizontal,
  search: Search,
  filter: Filter,
  settings: Settings,
  external: ExternalLink,
  user: User,
  "sign-out": LogOut,
  bell: Bell,

  // --- Actions ---
  add: Plus,
  remove: Minus,
  edit: Pencil,
  delete: Trash2,
  check: Check,
  copy: Copy,
  share: Share2,
  upload: Upload,
  download: Download,
  refresh: RefreshCw,
  undo: RotateCcw,
  show: Eye,
  hide: EyeOff,
  camera: Camera,
  image: Image,

  // --- State and feedback ---
  loading: Loader2,
  success: CheckCircle2,
  info: Info,
  empty: Circle,

  // --- Gamification: streaks, points, badges. Every app wants these. ---
  streak: Flame,
  trophy: Trophy,
  award: Award,
  star: Star,
  sparkle: Sparkles,
  target: Target,
  bolt: Zap,
  heart: Heart,

  // --- Data and time ---
  "trend-up": TrendingUp,
  "trend-down": TrendingDown,
  chart: BarChart3,
  activity: Activity,
  calendar: Calendar,
  clock: Clock,
  tag: Tag,
} satisfies Record<string, LucideIcon>;

export type CoreIconName = keyof typeof coreIcons;
export type IconRegistry = Record<string, LucideIcon>;
