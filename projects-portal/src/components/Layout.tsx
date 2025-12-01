import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Book, Music, Layout as LayoutIcon, Home, Tag, Volume2, Gamepad2, Video } from 'lucide-react';

const Layout: React.FC = () => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/books', icon: Book, label: 'Books' },
        { path: '/playlists', icon: Music, label: 'Playlists' },
        { path: '/lessons', icon: Video, label: 'Lessons' },
        { path: '/categories', icon: Tag, label: 'Categories' },
        { path: '/voices', icon: Volume2, label: 'Voices' },
        { path: '/games', icon: Gamepad2, label: 'Games' },
    ];

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                        <LayoutIcon className="w-8 h-8" />
                        Portal
                    </h1>
                </div>
                <nav className="mt-6">
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
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
