import React from 'react';
import { Gamepad2 } from 'lucide-react';

const Games: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Gamepad2 className="w-5 h-5 text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">Games</h1>
      </div>
      <p className="text-gray-600">
        Games management UI is not yet implemented in this portal build.
      </p>
    </div>
  );
};

export default Games;



