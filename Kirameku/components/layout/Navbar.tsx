"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  Home,
  BookOpen,
  MessageSquare,
  Newspaper,
  FolderGit2,
  Users,
  Camera,
  Clock,
  Music,
  User,
  Sun,
  Moon,
  Menu,
  X,
  Settings,
  Bookmark,
  ChevronDown,
  ExternalLink,
  Link2,
} from "lucide-react";
import {siteConfig} from "@/siteConfig";
import {
  isExternalHref,
  isInternalHref,
  isNavLinkActive,
  parseNavDropdownConfig,
  type NavDropdownConfig,
  type NavDropdownLink,
} from "@/lib/nav-dropdown";
import { navDropdownIcons } from "@/lib/nav-dropdown-icons";

const SettingsPanel = dynamic(() => import("@/components/ui/SettingsPanel"), { ssr: false });

const navLinks = [
  { href: "/", label: "首页", icon: Home },
  { href: "/posts", label: "文章", icon: BookOpen },
  { href: "/moments", label: "说说", icon: MessageSquare },
  { href: "/messages", label: "留言", icon: Newspaper },
  { href: "/bookmark", label: "收藏夹", icon: Bookmark },
  { href: "/projects", label: "项目", icon: FolderGit2 },
  { href: "/friends", label: "友链", icon: Users },
  { href: "/photowall", label: "照片墙", icon: Camera },
  { href: "/timeline", label: "归档", icon: Clock },
  { href: "/music", label: "音乐", icon: Music },
  { href: "/about", label: "关于", icon: User },
];

/**
 * 下拉菜单里的一条链接：站内路径交给 next/link，站外地址用原生 a 并在新标签页打开。
 */
function NavDropdownItem({
  link,
  onSelect,
  className,
}: {
  link: NavDropdownLink;
  onSelect: () => void;
  className: string;
}) {
  const external = isExternalHref(link.href);

  const content = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{link.label}</span>
        {external ? (
          <ExternalLink className="size-3 shrink-0 opacity-50" aria-hidden />
        ) : null}
      </span>
      {link.description ? (
        <span className="block truncate text-[11px] opacity-70">
          {link.description}
        </span>
      ) : null}
    </>
  );

  if (!external && isInternalHref(link.href)) {
    return (
      <Link href={link.href} onClick={onSelect} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a
      href={link.href}
      onClick={onSelect}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {content}
    </a>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [easterEgg, setEasterEgg] = useState(false);
  const clickTimes = useRef<number[]>([]);

  // 导航栏自定义下拉菜单：配置存在站点配置里，由 /api/nav-dropdown 读取。
  // 读不到或不合法时保持 null，导航栏退回纯静态链接，不影响整站渲染。
  const [navDropdown, setNavDropdown] = useState<NavDropdownConfig | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileGroupOpen, setIsMobileGroupOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/nav-dropdown", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!controller.signal.aborted) {
          setNavDropdown(parseNavDropdownConfig(payload));
        }
      })
      .catch(() => {
        // 拿不到配置时就当作没有自定义菜单。
      });
    return () => controller.abort();
  }, []);

  const handleLogoClick = useCallback(() => {
    const now = Date.now();
    clickTimes.current.push(now);
    clickTimes.current = clickTimes.current.filter(t => now - t < 2000);
    if (clickTimes.current.length >= 7) {
      clickTimes.current = [];
      setEasterEgg(true);

      // 全屏彩纸 + 闪烁
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:fixed;inset:0;z-index:99999;pointer-events:none";
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width;
      const H = canvas.height;

      // 生成粒子，分 3 波从不同位置发射
      const particles: {
        x: number; y: number; vx: number; vy: number;
        size: number; color: string; rotation: number; vr: number;
        gravity: number; opacity: number; shape: number; born: number;
      }[] = [];
      const colors = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff6bd6","#c084fc","#fb923c","#38bdf8"];
      for (let wave = 0; wave < 3; wave++) {
        const delay = wave * 15;
        for (let i = 0; i < 200; i++) {
          particles.push({
            x: Math.random() * W,
            y: -20 - Math.random() * 100,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 3 + 2,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.2,
            gravity: 0.05 + Math.random() * 0.05,
            opacity: 1,
            shape: Math.floor(Math.random() * 3), // 0=rect 1=circle 2=star
            born: delay,
          });
        }
      }

      let frame = 0;
      function animate() {
        ctx.clearRect(0, 0, W, H);
        let alive = false;
        for (const p of particles) {
          if (frame < p.born) { alive = true; continue; }
          const age = frame - p.born;
          p.x += p.vx + Math.sin(age * 0.02) * 0.5;
          p.y += p.vy;
          p.vy += p.gravity;
          p.vx *= 0.998;
          p.rotation += p.vr;
          p.opacity = Math.max(0, 1 - age / 300);
          if (p.opacity <= 0 || p.y > H + 20) continue;
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          if (p.shape === 0) {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else if (p.shape === 1) {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // 五角星
            const s = p.size / 2;
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
              const a = (j * 4 * Math.PI) / 5 - Math.PI / 2;
              const r = j === 0 ? s : s;
              ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
        frame++;
        if (alive) {
          requestAnimationFrame(animate);
        } else {
          canvas.remove();
        }
      }
      animate();

      // 彩蛋提示文字，等彩纸下完后出现
      setTimeout(() => {
        const msg = document.createElement("div");
        msg.innerHTML = `
          <div style="font-size:48px;margin-bottom:12px">🎉</div>
          <div style="font-size:24px;font-weight:bold;margin-bottom:8px">恭喜你发现了彩蛋！</div>
          <div style="font-size:14px;opacity:0.8">连续点击 Logo 7 次触发 · Starhiro の小站</div>
        `;
        msg.style.cssText = `
          position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
          z-index:99999;pointer-events:none;text-align:center;
          color:#fff;
          background:rgba(0,0,0,0.6);backdrop-filter:blur(12px);
          padding:32px 48px;border-radius:20px;
          border:1px solid rgba(255,255,255,0.2);
          box-shadow:0 8px 40px rgba(0,0,0,0.4);
          opacity:0;transition:opacity 0.8s ease;
          font-family:'Noto Serif SC',serif;
        `;
        document.body.appendChild(msg);
        requestAnimationFrame(() => { msg.style.opacity = "1"; });
        setTimeout(() => {
          msg.style.opacity = "0";
          setTimeout(() => msg.remove(), 1000);
        }, 3000);
      }, 3500);

      setTimeout(() => setEasterEgg(false), 8000);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSettingsOpen(false);
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // 子站页面隐藏主站导航栏
  if (pathname.startsWith("/garden")) return null;

  const activeDropdown =
    navDropdown && navDropdown.enabled && navDropdown.links.length > 0
      ? navDropdown
      : null;
  const DropdownIcon = activeDropdown ? navDropdownIcons[activeDropdown.icon] : Link2;
  const dropdownActive = activeDropdown
    ? activeDropdown.links.some((link) => isNavLinkActive(pathname, link.href))
    : false;
  const dropdownItemClass =
    "block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-sky-500/10 hover:text-sky-600 dark:text-slate-300 dark:hover:bg-sky-500/10 dark:hover:text-sky-300";
  const dropdownItemMobileClass =
    "block rounded-lg px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100/50 dark:text-slate-400 dark:hover:bg-slate-800/50";

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card rounded-none border-x-0 border-t-0">
        {/* 导航项比页面正文多（含可配置的下拉菜单），2xl 起容器略放宽；
            正文仍在 max-w-6xl 内，视觉重心不变 */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-6 xl:px-8 2xl:max-w-[86rem]">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/"
              onClick={handleLogoClick}
              className={`flex shrink-0 items-center space-x-0.5 whitespace-nowrap select-none ${easterEgg ? "animate-[spin_0.5s_ease-in-out_3]" : ""}`}
              style={easterEgg ? { animation: "spin 0.5s ease-in-out 6, rainbow 3s linear" } : undefined}
            >
              <span className={`text-xl font-bold tracking-tight ${easterEgg ? "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" : "text-slate-800 dark:text-white"}`} style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {siteConfig.authorName}
              </span>
              <span className={`text-xl font-bold ${easterEgg ? "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" : "text-sky-500 dark:text-sky-400"}`} style={{ fontFamily: "serif" }}>
                の
              </span>
              <span className={`text-xl font-bold tracking-tight ${easterEgg ? "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" : "text-slate-800 dark:text-white"}`} style={{ fontFamily: "'Noto Serif SC', serif" }}>
                秘密小窝
              </span>
            </Link>

            {/* Desktop Navigation */}
            {/* 导航项数量可以后台增加，所以尺寸按断点分三档：
                lg 小图标 + 紧凑内边距，2xl 内容宽度够用时才放大到原来的规格。
                链接一律 nowrap + shrink-0，避免文字被压成两行。 */}
            <div className="hidden min-w-0 items-center lg:flex lg:gap-x-0 xl:gap-x-0.5">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg px-1 py-2 text-xs font-medium transition-all duration-200 xl:gap-1 xl:px-2 xl:text-[13px] 2xl:gap-1.5 2xl:px-2.5 2xl:text-sm ${isActive
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 2xl:h-4 2xl:w-4" />
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-500 rounded-full"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* 自定义下拉菜单（后台「导航菜单」页配置）。
                  桌面端导航项数量可配置，图标只保留在移动端抽屉里，
                  否则 12 项以上一定挤成两行。 */}
              {activeDropdown && (
                <div
                  ref={dropdownRef}
                  className="relative"
                  onMouseEnter={() => setIsDropdownOpen(true)}
                  onMouseLeave={() => setIsDropdownOpen(false)}
                >
                  <button
                    type="button"
                    // 鼠标点击时 detail >= 1，而此时 onMouseEnter 已经把菜单打开，
                    // 再切换一次会立刻关掉；只有键盘（Enter/Space，detail === 0）才需要切换。
                    onClick={(event) => {
                      if (event.detail === 0) {
                        setIsDropdownOpen((open) => !open);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setIsDropdownOpen(false);
                      }
                    }}
                    aria-haspopup="true"
                    aria-expanded={isDropdownOpen}
                    aria-controls="navbar-dropdown-menu"
                    className={`relative flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg px-1 py-2 text-xs font-medium transition-all duration-200 xl:gap-1 xl:px-2 xl:text-[13px] 2xl:gap-1.5 2xl:px-2.5 2xl:text-sm ${dropdownActive
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                  >
                    <DropdownIcon className="h-3.5 w-3.5 shrink-0 2xl:h-4 2xl:w-4" />
                    {/* 菜单名称由后台自由填写，限宽后省略，避免长名称把整行导航撑溢出 */}
                    <span
                      className="max-w-[4rem] truncate"
                      title={activeDropdown.label}
                    >
                      {activeDropdown.label}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                    {dropdownActive && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-500 rounded-full"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        id="navbar-dropdown-menu"
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        // pt-1 而不是 mt-1：留出的间隙仍在 popover 盒内，
                        // 鼠标从按钮移到面板的途中不会触发 mouseleave 把菜单关掉。
                        className="absolute right-0 top-full z-50 w-64 origin-top-right pt-1"
                      >
                        <div className="rounded-2xl border border-white/50 bg-white/90 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90">
                          {/* 链接最多 20 条，超出视口高度时面板内部滚动 */}
                          <ul className="max-h-[min(24rem,calc(100dvh-6rem))] space-y-0.5 overflow-y-auto overscroll-contain">
                            {activeDropdown.links.map((link) => (
                              <li key={`${link.label}-${link.href}`}>
                                <NavDropdownItem
                                  link={link}
                                  onSelect={() => setIsDropdownOpen(false)}
                                  className={dropdownItemClass}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Theme Toggle, Settings & Mobile Menu */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                title="切换明暗主题"
                aria-label="切换明暗主题"
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                {/* 明暗两个图标都渲染、由 CSS 决定显示哪个：
                    服务端无需知道客户端主题，避免水合前后图标不一致。 */}
                <Sun className="hidden dark:block w-5 h-5" />
                <Moon className="block dark:hidden w-5 h-5" />
              </button>

              {/* Settings Button */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  title="设置"
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <AnimatePresence>
                  {isSettingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100/50 dark:text-slate-400 dark:hover:bg-slate-800/50 lg:hidden"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain glass-card rounded-none border-x-0 lg:hidden"
          >
            <div className="p-4 space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}

              {/* 自定义下拉菜单：移动端变成可展开的一组 */
              activeDropdown && (
                <div className="mt-1 border-t border-slate-200/60 pt-1 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsMobileGroupOpen((open) => !open)}
                    aria-expanded={isMobileGroupOpen}
                    aria-controls="navbar-mobile-dropdown"
                    className={`flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors ${dropdownActive
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                      }`}
                  >
                    <span className="flex items-center gap-3">
                      <DropdownIcon className="w-5 h-5" />
                      <span className="font-medium">{activeDropdown.label}</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${isMobileGroupOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isMobileGroupOpen && (
                      <motion.div
                        id="navbar-mobile-dropdown"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1 pb-1 pl-6">
                          {activeDropdown.links.map((link) => (
                            <NavDropdownItem
                              key={`${link.label}-${link.href}`}
                              link={link}
                              onSelect={() => setIsMobileMenuOpen(false)}
                              className={dropdownItemMobileClass}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
