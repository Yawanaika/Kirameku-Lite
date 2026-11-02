import {
  BookOpen,
  Camera,
  Compass,
  FolderGit2,
  Gamepad2,
  Globe,
  Heart,
  Link2,
  Music,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavDropdownIconName } from "./nav-dropdown";

/** 后台可选图标名到 lucide 组件的映射，前台导航与后台预览共用。 */
export const navDropdownIcons: Record<NavDropdownIconName, LucideIcon> = {
  link: Link2,
  compass: Compass,
  globe: Globe,
  sparkles: Sparkles,
  star: Star,
  book: BookOpen,
  folder: FolderGit2,
  users: Users,
  camera: Camera,
  music: Music,
  heart: Heart,
  gamepad: Gamepad2,
};
