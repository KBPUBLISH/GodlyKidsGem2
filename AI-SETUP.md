# AI Service Setup for Lesson Activity Generation

The lesson editor includes AI-powered activity generation that can automatically create quiz questions or reflection prompts from video captions.

## Supported AI Providers

The system supports two AI providers:
- **OpenAI** (default) - Uses GPT models
- **Google Gemini** - Uses Gemini models

## Configuration

### 1. Choose Your AI Provider

Set the `AI_PROVIDER` environment variable in your `.env` file:

```env
# For OpenAI (default)
AI_PROVIDER=openai

# OR for Google Gemini
AI_PROVIDER=gemini
```

### 2. OpenAI Setup

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to your `.env` file:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
```

**Available Models:**
- `gpt-4o-mini` (default, cost-effective)
- `gpt-4o`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

### 3. Google Gemini Setup

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to your `.env` file:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash  # Optional, defaults to gemini-1.5-flash
```

**Available Models:**
- `gemini-1.5-flash` (default, fast and cost-effective)
- `gemini-1.5-pro`
- `gemini-pro`

## Usage in Portal

1. **Add Captions**: First, add captions with text to your lesson video
2. **Choose Activity Type**: Select either "Quiz" or "Reflection" in the Activity Editor
3. **Generate**: Click the "Generate Activity" button (with sparkles icon)
4. **Review & Edit**: The AI will generate content that you can review and edit as needed

## How It Works

### Quiz Generation
- Analyzes all caption text from the video
- Generates an age-appropriate quiz question
- Creates 4 multiple-choice options
- Marks one option as correct

### Reflection Generation
- Analyzes all caption text from the video
- Considers devotional content if provided
- Generates a thoughtful reflection prompt
- Encourages children to internalize and apply what they learned

## Troubleshooting

### "AI_PROVIDER is not set"
- Make sure `AI_PROVIDER` is set to either `openai` or `gemini` in your `.env` file

### "OPENAI_API_KEY is not set" or "GEMINI_API_KEY is not set"
- Make sure the appropriate API key is set in your `.env` file
- Restart the backend server after adding the key

### "Failed to generate activity"
- Check that your API key is valid
- Verify you have credits/quota available
- Check backend console logs for detailed error messages
- Ensure captions have text content (not just timestamps)

### Rate Limits
- OpenAI: Check your [usage limits](https://platform.openai.com/usage)
- Gemini: Check your [quota limits](https://ai.google.dev/pricing)

## Cost Considerations

- **OpenAI GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Gemini 1.5 Flash**: Free tier available, then pay-as-you-go

For typical lesson generation:
- Each generation uses ~500-1000 tokens
- Very cost-effective for occasional use
- Consider caching if generating many activities

## Example .env Configuration

```env
# AI Configuration
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# OR for Gemini:
# AI_PROVIDER=gemini
# GEMINI_API_KEY=...
# GEMINI_MODEL=gemini-1.5-flash
```



