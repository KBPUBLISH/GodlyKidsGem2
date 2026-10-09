import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { ApiService } from '../services/apiService';

/**
 * First Story Landing Page
 * After account creation, land user in a story (not home grid)
 * Automatically picks a good first story and starts it
 */
const FirstStoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFirstStory = async () => {
      try {
        // Get kid's age band from onboarding
        const ageBand = localStorage.getItem('godlykids_kid_age_band') || '5-7';
        
        // Fetch books from API
        const books = await ApiService.getBooks();
        
        if (!books || books.length === 0) {
          // Fallback to home if no books available
          navigate('/world', { replace: true });
          return;
        }

        // Pick a good first story based on age
        // For younger kids (2-4), pick shorter stories
        // For older kids (8+), pick more advanced content
        let firstBook = books[0];
        
        // Try to find an age-appropriate book
        const ageNum = parseInt(ageBand.split('-')[0], 10) || 5;
        const filtered = books.filter((book: any) => {
          // Prefer books marked as beginner or appropriate for age
          if (ageNum < 5 && book.difficulty === 'beginner') return true;
          if (ageNum >= 5 && ageNum < 8 && book.difficulty !== 'advanced') return true;
          if (ageNum >= 8) return true;
          return false;
        });
        
        if (filtered.length > 0) {
          // Pick a random book from filtered list for variety
          firstBook = filtered[Math.floor(Math.random() * filtered.length)];
        }

        // Navigate to the story reader
        if (firstBook && firstBook.id) {
          setTimeout(() => {
            navigate(`/read/${firstBook.id}`, { 
              replace: true,
              state: { fromOnboarding: true }
            });
          }, 1000); // Small delay for smooth transition
        } else {
          // Fallback to home
          navigate('/world', { replace: true });
        }
      } catch (error) {
        console.error('Error loading first story:', error);
        // Fallback to home on error
        navigate('/world', { replace: true });
      }
    };

    loadFirstStory();
  }, [navigate]);

  return (
    <div 
      className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col items-center justify-center overflow-hidden"
      style={{ paddingTop: 'var(--safe-area-top, 0px)' }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-4 w-40 h-28 bg-gradient-to-r from-[#c7d2fe]/50 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-32 right-0 w-48 h-32 bg-gradient-to-l from-[#fde68a]/35 to-transparent rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 text-center px-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-indigo-300/40 animate-pulse">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="font-display font-extrabold text-3xl text-[#1e1b4b] mb-3">
          Welcome to Godly Kids!
        </h1>
        
        <p className="text-[#64748b] text-lg mb-8">
          Let's start with your first story...
        </p>
        
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#6366f1]" />
      </div>

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default FirstStoryPage;
