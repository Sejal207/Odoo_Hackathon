import { useState, useEffect } from 'react';
import { Search, Bell, Sun, ChevronDown, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import apiClient from '../../services/apiClient';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTimer, setMenuTimer] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const openMenu = () => {
    setMenuOpen(true);
    if (menuTimer) {
      clearTimeout(menuTimer);
    }
    const timer = setTimeout(() => {
      setMenuOpen(false);
      setMenuTimer(null);
    }, 120000);
    setMenuTimer(timer);
  };

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      if (menuTimer) {
        clearTimeout(menuTimer);
        setMenuTimer(null);
      }
      return;
    }

    openMenu();
  };

  useEffect(() => () => {
    if (menuTimer) {
      clearTimeout(menuTimer);
    }
  }, [menuTimer]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/notifications', { params: { unread: true } })
      .then((res) => {
        const notifications = res.data?.data ?? res.data;
        if (!cancelled) setUnreadCount(Array.isArray(notifications) ? notifications.length : 0);
      })
      .catch(() => { }); // silent - the bell just shows 0 if this fails, non-critical
    return () => { cancelled = true; };
  }, []);

  return (
    <header className="flex h-16 items-center justify-end border-b border-gray-200 bg-white px-6">
      {/* <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search assets, employees, bookings..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-14 text-sm text-[#061E29] placeholder:text-gray-400 focus:border-[#1D546D] focus:outline-none"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-gray-400">
          ⌘K
        </kbd>
      </div> */}

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/notifications')}
          className="relative rounded-full p-2 text-[#1D546D] hover:bg-gray-100"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* <button className="rounded-full p-2 text-[#1D546D] hover:bg-gray-100" title="Theme (coming soon)">
          <Sun className="h-5 w-5" />
        </button> */}

        <div className="relative">
          <button
            onClick={toggleMenu}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1D546D] text-xs font-semibold text-white">
              {initials}
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-[#061E29]">{user?.name}</p>
                <p className="truncate text-xs text-gray-400">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (menuTimer) {
                    clearTimeout(menuTimer);
                    setMenuTimer(null);
                  }
                  logout();
                  navigate('/login', { replace: true });
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}