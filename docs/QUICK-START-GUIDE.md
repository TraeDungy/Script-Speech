# Script-Speech Quick Start Guide

**Welcome!** Get your first voiceover in 5 minutes.

---

## Installation (1 minute)

### Option 1: Web App (Easiest)
Just go to: **https://script-speech.vercel.app**

No installation needed. Works in any browser.

### Option 2: API (For Developers)
```bash
# Install Node.js (if you haven't)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Create a project
mkdir my-voiceovers
cd my-voiceovers
npm init -y
npm install axios

# Create a script (see examples below)
```

---

## Your First Voiceover (3 minutes)

### Step 1: Go to Script-Speech
Open: https://script-speech.vercel.app

### Step 2: Paste Your Text
```
Here's some example text:
"Welcome to my YouTube channel. Today we're 
exploring the future of artificial intelligence."
```

Just copy-paste into the text area.

### Step 3: Choose a Voice
Click the dropdown and pick your favorite:
- **James** - Professional, authoritative
- **Emma** - Warm, friendly
- **David** - Clear, energetic
- **Maya** - Upbeat, modern
- **And 45 more...**

**Pro tip:** Try a few until you find your style!

### Step 4: Click Generate
Hit the big blue "Generate" button and wait 5-10 seconds.

### Step 5: Download
Click "Download MP3" and save to your computer.

**Done!** You just created a professional voiceover in < 1 minute.

---

## Common Use Cases

### Use Case 1: YouTube Voiceovers

**Goal:** Add voiceover to your YouTube video

**Steps:**
1. Write your script in a document
2. Copy-paste into Script-Speech
3. Generate voiceover (takes 30 seconds)
4. Download MP3
5. Import into your video editor (Premiere, DaVinci, CapCut)
6. Sync audio to video
7. Upload to YouTube

**Time saved:** 4-6 hours per video (vs hiring voice actor)

**Example:**
```
"In this tutorial, I'll show you how to use Script-Speech.
First, go to the website. Then paste your text. 
That's it! You're done."
```

---

### Use Case 2: Podcast Intros

**Goal:** Create professional intro for your podcast

**Steps:**
1. Write your intro script
2. Generate voiceover
3. Download MP3
4. Add intro to your podcast audio file
5. Publish to Spotify, Apple Podcasts, etc.

**Example Script:**
```
"Welcome to The Tech Podcast. I'm your host, Sarah. 
Today we're talking about AI. Stick around."
```

**Bonus:** Generate an outro too!
```
"Thanks for listening to The Tech Podcast. 
Subscribe for weekly episodes. See you next week."
```

---

### Use Case 3: Audiobook Narration

**Goal:** Convert your eBook to audiobook

**Steps:**
1. Export your eBook as plain text
2. Split into chapters (5-10 min each)
3. Generate voiceover for each chapter
4. Combine all audio files
5. Upload to Audible, Google Play Books, or distribute yourself

**Example Chapter:**
```
"Chapter 1: The Beginning.
Sarah had always dreamed of starting her own business.
She wasn't sure how to begin, but she knew it was time."
```

---

### Use Case 4: Marketing Videos

**Goal:** Create professional ads with voiceovers

**Steps:**
1. Write your ad copy
2. Generate voiceover
3. Download MP3
4. Create video with captions + voiceover
5. Share on social media

**Example Script:**
```
"Are you tired of expensive voiceovers? 
Try Script-Speech. Professional AI voices. $10/month. 
No voice actors required. 
Get your first voiceover free."
```

---

### Use Case 5: Multilingual Content

**Goal:** Dub your video into multiple languages

**Steps:**
1. Translate script to target language
2. Generate voiceover in that language
3. Download MP3
4. Add to your video
5. Publish localized version

**Supported Languages:**
English, Spanish, French, German, Italian, Portuguese, Dutch, Swedish, Norwegian, Danish, Russian, Polish, Turkish, Arabic, Hindi, Japanese, Korean, Mandarin, Cantonese, Thai, Vietnamese, Filipino, Indonesian, and 25+ more.

**Example:**
English: "Hello, welcome to my channel"  
Spanish: "Hola, bienvenido a mi canal"  
French: "Bonjour, bienvenue sur ma chaîne"  

Generate all three in 5 minutes!

---

## Pro Tips & Tricks

### Tip 1: Control Pronunciation
Use SSML markup for custom pronunciation:

```
I work at <phoneme alphabet="ipa" ph="ˈɡuːɡəl">Google</phoneme>.
```

This ensures "Google" is pronounced correctly.

### Tip 2: Add Pauses
```
Welcome to my podcast. <break time="2s"/>
Today's topic is amazing.
```

This adds a 2-second pause between sentences.

### Tip 3: Adjust Speaking Rate
In the Voice Settings:
- **Slower (0.75x):** For educational content
- **Normal (1.0x):** Default, good for most content
- **Faster (1.25x):** For energetic/upbeat content
- **Very Fast (1.5x+):** For summaries/updates

### Tip 4: Batch Generate
Have 10 scripts? Upload a CSV:
```csv
script,voice
"Welcome to Script-Speech",James
"Thanks for watching",Maya
"See you next time",David
```

Upload and generate all at once!

### Tip 5: A/B Test Voices
Generate the same script with 3 different voices and pick the best one.

```
Script: "Click here to learn more"

Voice 1: James (professional)
Voice 2: Maya (friendly)
Voice 3: David (energetic)

Pick whichever performs best in your video!
```

---

## Troubleshooting

### Problem: "Audio generation failed"
**Solution:** 
- Check your internet connection
- Try a shorter script (under 500 characters)
- Wait 30 seconds and try again
- Contact support: support@script-speech.app

### Problem: "Voice sounds robotic"
**Solution:**
- Try a different voice (they have different personalities)
- Adjust speaking rate (slower sounds more natural)
- Add punctuation to your script (helps with inflection)
- Add SSML markup for emotion

### Problem: "Can't download the MP3"
**Solution:**
- Check your browser's download folder
- Try a different browser
- Try generating a shorter script first
- Clear your browser cache

### Problem: "Pronunciation is wrong"
**Solution:**
- Use SSML `<phoneme>` tag for custom pronunciation
- Try splitting into smaller sentences
- Contact support with the problematic word

---

## API Quick Start (For Developers)

### Authentication
```javascript
const API_KEY = "your_api_key_here";
```

Get your API key from: https://script-speech.vercel.app/settings/api

### Generate Voiceover
```javascript
const axios = require('axios');

async function generateVoiceover() {
  const response = await axios.post(
    'https://script-speech.vercel.app/api/tts/generate',
    {
      text: 'Hello world',
      voice: 'James',
      language: 'en'
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    }
  );
  
  console.log(response.data);
  // { audio: "base64-encoded-audio", credits_used: 10 }
}

generateVoiceover();
```

### Example: Python
```python
import requests

API_KEY = "your_api_key_here"

response = requests.post(
    'https://script-speech.vercel.app/api/tts/generate',
    json={
        'text': 'Hello world',
        'voice': 'James',
        'language': 'en'
    },
    headers={
        'Authorization': f'Bearer {API_KEY}'
    }
)

audio = response.json()['audio']
print(f"Audio: {audio[:50]}...")
```

### Example: cURL
```bash
curl -X POST https://script-speech.vercel.app/api/tts/generate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "voice": "James",
    "language": "en"
  }'
```

---

## Pricing & Credits

### How Credits Work
Each character uses 1 credit.

**Example:**
- 100 characters = 100 credits
- 10,000 characters = 10,000 credits

### Plans
| Plan | Monthly Cost | Characters | Cost Per 1M Chars |
|------|-------------|-----------|------------------|
| Creator | $10 | 10,000 | $1000 |
| Pro | $50 | 100,000 | $500 |
| Agency | $250 | 1,000,000 | $250 |

### Free Trial
All new users get 1,000 free credits (no card required).

---

## Support

### Documentation
- Full API docs: https://script-speech.vercel.app/docs/api
- Pricing FAQ: https://script-speech.vercel.app/faq
- Blog: https://script-speech.vercel.app/blog

### Contact Support
- Email: support@script-speech.app
- Live chat: https://script-speech.vercel.app/support
- Twitter: @script_speech

### Community
- Discord: https://discord.gg/script-speech
- Twitter: https://twitter.com/script_speech
- YouTube: https://youtube.com/@script-speech

---

## What's Next?

### Step 1: Create Your Account
Go to https://script-speech.vercel.app and sign up (takes 30 seconds).

### Step 2: Generate Your First Voiceover
Paste some text and hit generate. You've got 1,000 free credits.

### Step 3: Download & Use
Download your MP3 and use it however you want.

### Step 4: Scale Up
When you need more credits, choose a plan that fits your needs.

---

## Common Questions

**Q: Do I need to credit Script-Speech?**  
A: Nope! You own the audio 100%. Use it commercially without attribution.

**Q: Can I use this for my business?**  
A: Absolutely! All plans include commercial rights.

**Q: What if I exceed my monthly credits?**  
A: We'll warn you when you're at 90%. Upgrade anytime.

**Q: Can I refund unused credits?**  
A: Yes! Unused credits roll over to next month. No loss.

**Q: How do I cancel?**  
A: Cancel anytime from your account settings. No questions asked.

---

## Success Stories

### Sarah's YouTube Channel
**Challenge:** Recording voiceovers took 2 hours per video. Monthly cost was $500 with voice actors.

**Solution:** Used Script-Speech to generate voiceovers in 5 minutes.

**Result:** 
- 10x faster content creation
- Consistent voice across all videos
- Saved $500/month
- Views increased 40% (faster publishing)

### Miguel's Podcast
**Challenge:** Podcast production took 5 hours per week. Wanted daily episodes but couldn't afford voice talent for intros/outros.

**Solution:** Generated podcast intro/outro with Script-Speech.

**Result:**
- Daily episodes instead of weekly
- Listener growth: 50% month-over-month
- Sponsorship opportunities opened up
- Saved countless hours

### Amit's eBook Business
**Challenge:** Converting eBooks to audiobooks cost $5000 per book.

**Solution:** Used Script-Speech API for bulk generation.

**Result:**
- 10 audiobooks created in 1 week
- $500 total cost (vs $50,000 with professionals)
- Sold on Audible, Google Play, Scribd
- New revenue stream: $2000/month

---

## Ready to Start?

👉 **Go to https://script-speech.vercel.app now**

- No credit card needed for trial
- 1,000 free credits included
- 5-minute setup
- Your first voiceover in 2 minutes

---

## Questions?

Can't find your answer here?

→ **Visit our FAQ:** https://script-speech.vercel.app/faq  
→ **Email support:** support@script-speech.app  
→ **Join our Discord:** https://discord.gg/script-speech  

---

**Happy creating!** 🎙️✨

We can't wait to hear what you make with Script-Speech.

**- The Script-Speech Team**
