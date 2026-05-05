import {
  FlaskConical,
  Sword,
  Shield,
  Gem,
  Cat,
  Package,
  Hammer,
  Sparkles,
  type LucideProps,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  FlaskConical,
  Sword,
  Shield,
  Gem,
  Cat,
  Package,
  Hammer,
  Sparkles,
};

export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? Package;
  return <Icon {...props} />;
}
