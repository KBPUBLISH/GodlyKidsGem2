"""
Compatibility patch for transformers library.
Fixes BeamSearchScorer import issue with newer transformers versions.
This must be imported BEFORE TTS.api is imported.
"""
import transformers

# Patch BeamSearchScorer to be available in transformers namespace
# In transformers 4.28+, BeamSearchScorer was moved to transformers.generation.beam_search
try:
    from transformers.generation.beam_search import BeamSearchScorer
    
    # Add directly to transformers module
    transformers.BeamSearchScorer = BeamSearchScorer
    
    # Add to __all__ if it exists (helps with 'from transformers import *')
    if hasattr(transformers, '__all__'):
        if 'BeamSearchScorer' not in transformers.__all__:
            transformers.__all__.append('BeamSearchScorer')
    
    # Patch __getattr__ for Python 3.7+ module __getattr__ support
    if not hasattr(transformers, '_patched_getattr'):
        original_getattr = getattr(transformers, '__getattr__', None)
        transformers._patched_getattr = True
        
        def patched_getattr(name):
            if name == 'BeamSearchScorer':
                return BeamSearchScorer
            if original_getattr:
                return original_getattr(name)
            raise AttributeError(f"module 'transformers' has no attribute '{name}'")
        
        transformers.__getattr__ = patched_getattr
    
    print("✅ Patched BeamSearchScorer into transformers namespace")
except Exception as e:
    print(f"⚠️ Warning: Could not patch BeamSearchScorer: {e}")
    pass

