import { ArrowRight, ShieldIcon, UserIcon } from "lucide-react"
import { Link, Navigate } from "react-router-dom"
import LoginLeftSide from "../components/LoginLeftSide"
import Loading from "../components/Loading";
import { useAuth } from "../../context/AuthContext";
import logo from "../assets/favicon.png";

const LoginLanding = () => {
    const { user, loading } = useAuth();
    if (loading) return <Loading />
    if (user) return <Navigate to="/dashboard" replace />
    const portalOptions = [
        {
            to: "/login/admin",
            title: "Admin Portal",
            description: "Manage Employees, KPIs and Payroll",
            icon: ShieldIcon
        },
        {
            to: "/login/employee",
            title: "Employee Portal",
            description: "View your profile, track Attendance, request time off and access Payslips.",
            icon: UserIcon
        }
    ]
    return (
        <div className="min-h-screen flex flex-col md:flex-row">
            <LoginLeftSide />
            <div className="w-fit md:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-16 relative overflow-y-auto min-h-screen">
                <div className="w-full max-w-md animate-fade-in relative z-10">

                    {/* Mobile Brand Header */}
                    <div className="md:hidden mx-auto max-w-fit flex items-center gap-3.5 mb-8 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl shadow-xs">
                      <img src={logo} alt="D&S Investment Logo" className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-slate-200 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">D&S Investment</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">DS Nexus</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">Enterprise Management System</p>
                      </div>
                    </div>

                    {/* Header */}
                    <div className="mb-10 text-center md:text-left">
                        <h2 className="text-3xl font-medium text-slate-900 tracking-tight mb-3">Welcome Back!</h2>
                        <p className="text-slate-500">Select your portal to securely access the system.</p>
                    </div>

                    {/* Portals List */}
                    <div className="space-y-4">
                        {portalOptions.map((portal) => (
                            <Link key={portal.to} to={portal.to} className="group block bg-slate-50 border border-slate-200 rounded-lg p-5 sm:p-6 transition-all duration-300 hover:border-indigo-400 hover:bg-indigo-50">
                                <div className="relative z-10 flex items-center justify-between gap-4 sm:gap-5">
                                    <h3 className="text-lg text-slate-800 group-hover:text-indigo-600 mb-1 transition-colors">{portal.title}</h3>
                                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all duration-300" />
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-center md:text-left text-xs text-slate-400 space-y-1.5">
                        <p>© {new Date().getFullYear()} D&S Investment. All rights reserved.</p>
                        <p className="text-slate-500 md:hidden">
                            Developed by{" "}
                            <a
                                href="https://nitya-devs.vercel.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition-colors"
                            >
                                Nitya Prakash Pattanaik
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoginLanding
