import type { LucideIcon } from "lucide-react";
import {
  CalendarIcon,
  ChevronRightIcon,
  IndianRupee,
  FileTextIcon,
  LayoutGridIcon,
  MenuIcon,
  SettingsIcon,
  UserIcon,
  XIcon,
  LogOutIcon,
  Loader2,
  Award,
  MessageSquarePlus,
  ShieldCheck,
  Building2,
  CalendarDays,
  BadgePercent,
  ScrollText,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../api/axios";
import logo from "../assets/favicon.png";
import InstallPwaButton from "./InstallPwaButton";

type NavChild = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  id: string;
  name: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
};

const Sidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [fetchedName, setFetchedName] = useState("");
  const [fetchedCode, setFetchedCode] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, loading } = useAuth();

  useEffect(() => {
    api.get("/profile")
      .then(({ data }) => {
        if (data && data.firstName) {
          setFetchedName(`${data.firstName} ${data.lastName || ""}`.trim());
        }
        if (data && data.employeeCode) {
          setFetchedCode(data.employeeCode);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const role = user?.role;
  const isAdmin = role === "ADMIN";
  const formattedEmailName = user?.email ? user.email.split("@")[0] : "";
  const userName =
    fetchedName || user?.name || formattedEmailName;

  const navGroups: NavGroup[] = [
    {
      id: "dashboard",
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutGridIcon,
    },
    ...(isAdmin
      ? [
          {
            id: "workforce",
            name: "Workforce",
            icon: Users,
            children: [
              { name: "Employees", href: "/employees", icon: UserIcon },
              { name: "Department", href: "/departments", icon: Building2 },
              { name: "Holidays", href: "/holidays", icon: CalendarDays },
            ],
          },
        ]
      : []),
    {
      id: "time-leave",
      name: "Time & Leave",
      icon: CalendarIcon,
      children: [
        { name: "Attendance", href: "/attendance", icon: CalendarIcon },
        { name: "Leave", href: "/leave", icon: FileTextIcon },
      ],
    },
    ...(isAdmin
      ? [
          {
            id: "payroll",
            name: "Payroll & Finance",
            icon: IndianRupee,
            children: [
              { name: "Payslips", href: "/payslips", icon: IndianRupee },
              { name: "Incentive", href: "/incentives", icon: BadgePercent },
            ],
          },
        ]
      : [
          {
            id: "payslips",
            name: "Payslips",
            href: "/payslips",
            icon: IndianRupee,
          },
        ]),
    {
      id: "performance",
      name: "Performance",
      icon: Award,
      children: [
        {
          name: isAdmin ? "KPA & Appraisal" : "My KPA Scorecard",
          href: isAdmin ? "/kpa" : "/kpa/scorecard",
          icon: Award,
        },
        { name: "Feedback", href: "/feedback", icon: MessageSquarePlus },
      ],
    },
    ...(isAdmin
      ? [
          {
            id: "administration",
            name: "Administration",
            icon: ShieldCheck,
            children: [
              { name: "Authorization", href: "/authorization", icon: ShieldCheck },
              { name: "Activity Logs", href: "/activity-logs", icon: ScrollText },
              { name: "Settings", href: "/settings", icon: SettingsIcon },
            ],
          },
        ]
      : [
          {
            id: "settings",
            name: "Settings",
            href: "/settings",
            icon: SettingsIcon,
          },
        ]),
  ];

  // Track expanded parent menus
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      if (
        g.children?.some((c) =>
          c.href === "/dashboard" ? pathname === c.href : pathname.startsWith(c.href)
        )
      ) {
        initial[g.id] = true;
      }
    });
    return initial;
  });

  // Automatically ensure active route's group is open
  useEffect(() => {
    navGroups.forEach((g) => {
      if (
        g.children?.some((c) =>
          c.href === "/dashboard" ? pathname === c.href : pathname.startsWith(c.href)
        )
      ) {
        setOpenMenus((prev) => ({ ...prev, [g.id]: true }));
      }
    });
  }, [pathname, isAdmin]);

  const toggleMenu = (groupId: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const sidebarContent = (
    <>
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logo}
              alt="D&S Investment Logo"
              className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5 shrink-0 border border-white/10"
            />
            <div className="min-w-0">
              <p className="font-semibold text-[13px] text-white tracking-wide">
                DS Nexus
              </p>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Employee Management System
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>

      {userName && (
        <div className="mx-3 mt-4 mb-1 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ring-1 ring-white/10 shrink-0">
              <span className="text-slate-400 text-xs font-semibold">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-200 truncate">
                {userName}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[11px] text-slate-500 truncate">
                  {isAdmin ? "Administrator" : "Employee"}
                </p>
                {(fetchedCode || user?.employeeCode) && (
                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30">
                    #{fetchedCode || user?.employeeCode}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pt-5 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Navigation
        </p>
      </div>

      <nav
        className="flex-1 px-3 space-y-1 overflow-y-auto"
        aria-label="Main navigation"
      >
        {loading ? (
          <div className="flex items-center gap-2 p-3 text-slate-400">
            <Loader2 className="animate-spin w-4 h-4" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          navGroups.map((group) => {
            const Icon = group.icon;
            const hasChildren = Boolean(group.children && group.children.length > 0);

            // Standalone direct item (e.g. Dashboard)
            if (!hasChildren && group.href) {
              const isActive =
                group.href === "/dashboard"
                  ? pathname === group.href
                  : pathname.startsWith(group.href);

              return (
                <Link
                  key={group.id}
                  to={group.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-all duration-150 relative ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-300 font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-indigo-500" />
                  )}
                  <Icon
                    className={`size-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-indigo-400"
                        : "text-slate-400 group-hover:text-slate-300"
                    }`}
                  />
                  <span className="flex-1">{group.name}</span>
                  {isActive && (
                    <ChevronRightIcon className="size-4 text-indigo-400" />
                  )}
                </Link>
              );
            }

            // Parent Menu with expandable children
            const isGroupActive = Boolean(
              group.children?.some((child) =>
                child.href === "/dashboard"
                  ? pathname === child.href
                  : pathname.startsWith(child.href)
              )
            );
            const isOpen = Boolean(openMenus[group.id]);

            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleMenu(group.id)}
                  className={`group flex items-center gap-3 w-full px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 text-left select-none cursor-pointer ${
                    isGroupActive
                      ? "text-white bg-white/5 font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon
                    className={`size-4 shrink-0 transition-colors ${
                      isGroupActive
                        ? "text-indigo-400"
                        : "text-slate-400 group-hover:text-slate-300"
                    }`}
                  />
                  <span className="flex-1">{group.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                      {group.children!.length}
                    </span>
                    <ChevronRightIcon
                      className={`size-3.5 transition-transform duration-200 ${
                        isOpen
                          ? "rotate-90 text-indigo-400"
                          : "text-slate-500 group-hover:text-slate-300"
                      }`}
                    />
                  </div>
                </button>

                {/* Submenu Children */}
                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    isOpen
                      ? "max-h-96 opacity-100 my-0.5"
                      : "max-h-0 opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="ml-5 pl-2.5 border-l border-white/10 space-y-0.5 py-0.5">
                    {group.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive =
                        child.href === "/dashboard"
                          ? pathname === child.href
                          : pathname.startsWith(child.href);

                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setMobileOpen(false)}
                          className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150 relative ${
                            isChildActive
                              ? "bg-indigo-500/20 text-indigo-200 font-semibold"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {isChildActive && (
                            <div className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-indigo-500" />
                          )}
                          <ChildIcon
                            className={`size-3.5 shrink-0 transition-colors ${
                              isChildActive
                                ? "text-indigo-400"
                                : "text-slate-500 group-hover:text-slate-300"
                            }`}
                          />
                          <span className="flex-1 truncate">{child.name}</span>
                          {isChildActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </nav>

      <div className="p-3 border-t border-white/10">
        <InstallPwaButton />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-[13px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/8 transition-all duration-150 cursor-pointer"
        >
          <LogOutIcon className="w-4.25 h-4.25" />
          <span className="ml-2 text-sm font-medium">Log Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-lg shadow-lg border border-white/10 cursor-pointer"
        aria-label="Open sidebar"
      >
        <MenuIcon size={20} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className="hidden lg:flex flex-col h-full w-65 bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 text-white shrink-0 border-r border-white/10">
        {sidebarContent}
      </aside>

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-72 bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 text-white z-[70] flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
