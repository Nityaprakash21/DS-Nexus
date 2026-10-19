import { useEffect, useState } from "react"
import Loading from "../components/Loading"
import ProfileForm from "../components/ProfileForm.js"
import { Lock } from "lucide-react"
import ChangePasswordModal from "../components/ChangePasswordModal.js"
import { useAuth } from "../../context/AuthContext.js"
import toast from "react-hot-toast"
import api from "../api/axios.js"

const Settings = () => {

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { user } = useAuth();

  const fetchProfile = async () => {
    try {
      const res = await api.get("/profile");
      const profile = res.data;
      if (profile) setProfile(profile)
    } catch {
      toast.error("Failed to fetch profile");
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [user])

  if (loading) return <Loading />

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and preferences</p>
      </div>

      {profile && <ProfileForm initialData={profile} onSuccess={fetchProfile} />}

      {/* Change Password Trigger */}
      <div className="card max-w-md p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-lg">
            <Lock className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Password</p>
            <p className="text-sm text-slate-500">Update your account password</p>
          </div>
        </div>
        <button onClick={() => setShowPasswordModal(true)} className="btn-secondary text-sm">
          Change
        </button>
      </div>
      <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  )
}

export default Settings