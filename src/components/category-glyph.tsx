import {
  Tag,
  AlertCircle,
  ArrowRightLeft,
  Briefcase,
  Car,
  Coffee,
  Gift,
  Heart,
  HeartPulse,
  Home,
  MoreHorizontal,
  Palette,
  PiggyBank,
  Plane,
  PlusCircle,
  Repeat,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Categories store a kebab-case lucide icon name. Curated map of every icon the
// seed uses, so we render real icons (lean bundle) and fall back to Tag.
const ICONS: Record<string, LucideIcon> = {
  "alert-circle": AlertCircle,
  "arrow-right-left": ArrowRightLeft,
  briefcase: Briefcase,
  car: Car,
  coffee: Coffee,
  gift: Gift,
  heart: Heart,
  "heart-pulse": HeartPulse,
  home: Home,
  "more-horizontal": MoreHorizontal,
  palette: Palette,
  "piggy-bank": PiggyBank,
  plane: Plane,
  "plus-circle": PlusCircle,
  repeat: Repeat,
  shield: Shield,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  sparkles: Sparkles,
  target: Target,
  "trending-up": TrendingUp,
  tv: Tv,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
  zap: Zap,
  tag: Tag,
};

// A rounded tile tinted with the category's color, holding its icon. Replaces
// the old bare color dots: still color-codes, but reads as a real object and
// carries meaning. Works in both server and client components.
export function CategoryGlyph({
  icon,
  color,
  size = 36,
  className,
}: {
  icon?: string | null;
  color: string;
  size?: number;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || Tag;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[10px] border",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 24%, transparent)`,
        color,
      }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
