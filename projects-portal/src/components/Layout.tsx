import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Book, Music, Layout as LayoutIcon, Home, Tag, Volume2, Gamepad2, Video, LogOut, Bell, Music2, Star, CalendarDays, BarChart3, Library, Link2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/featured', icon: Star, label: 'Featured' },
        { path: '/books', icon: Book, label: 'Books' },
        { path: '/book-series', icon: Library, label: 'Book Series' },
        { path: '/playlists', icon: Music, label: 'Playlists' },
        { path: '/lessons', icon: Video, label: 'Lessons' },
        { path: '/lessons/calendar', icon: CalendarDays, label: 'Lesson Calendar' },
        { path: '/categories', icon: Tag, label: 'Categories' },
        { path: '/voices', icon: Volume2, label: 'Voices' },
        { path: '/games', icon: Gamepad2, label: 'Games' },
        { path: '/notifications', icon: Bell, label: 'Notifications' },
        { path: '/music', icon: Music2, label: 'Music' },
        { path: '/codes', icon: Link2, label: 'Code Management' },
    ];

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                        <LayoutIcon className="w-8 h-8" />
                        Portal
                    </h1>
                </div>
                <nav className="mt-6 flex-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center px-6 py-3 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors ${isActive(item.path) ? 'bg-indigo-50 text-indigo-600 border-r-4 border-indigo-600' : ''
                                }`}
                        >
                            <item.icon className="w-5 h-5 mr-3" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    ))}
                </nav>
                
                {/* Logout Button */}
                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
