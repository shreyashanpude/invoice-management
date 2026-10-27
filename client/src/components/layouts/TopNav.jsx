import { Menu, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export default function TopNav({ onMenuOpen }) {
  const { user } = useAuth();
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between">
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Notifications">
          <Bell className="w-5 h-5" />
        </button>

        <Link to="/profile" className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 transition-colors">
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
            {initials}
          </div>
          <span className="hidden sm:block text-sm font-medium text-slate-700">{user?.name}</span>
        </Link>
      </div>
    </header>
  );
}
