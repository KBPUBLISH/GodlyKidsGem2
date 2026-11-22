"""First-friend regression now follows the original pack activities and treasure game."""
import runpy
from pathlib import Path
if __name__=='__main__':
    runpy.run_path(str(Path(__file__).with_name('original-story-browser.py')),run_name='__main__')
