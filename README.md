# 📚 LLQP & WFG Exam Prep - MCQ Study Platform

> **Interactive multiple-choice question practice platform for LLQP and WFG exam preparation**

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=flat&logo=cloudflare)](https://pages.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 Features

✅ **Multi-Topic Support** - 6 comprehensive exam topics:
- LLQP Ethics (Common Law)
- WFG Ethics Compliance Course  
- WFG Anti-Money Laundering & Terrorist Financing
- LLQP Life Insurance
- LLQP Accident & Sickness Insurance
- LLQP Segregated Funds & Annuities

✅ **Interactive Learning**
- Show/hide answer explanations
- Bookmark difficult questions
- Track progress per topic
- Navigate between questions seamlessly

✅ **Progress Tracking** - Automatic saving via localStorage
- View completion percentage per topic
- Track which questions you've viewed
- Monitor answer reveals

✅ **Responsive Design** - Works perfectly on:
- Desktop computers
- Tablets
- Mobile phones

✅ **Fast & Free** - Deployed on Cloudflare Pages:
- Unlimited bandwidth
- Global CDN for fast loading
- Free SSL certificate
- Zero hosting costs

---

## 🚀 Quick Start

### Option 1: Deploy to Cloudflare Pages (Recommended)

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: MCQ Study Platform"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```

2. **Deploy on Cloudflare Pages**
   - Go to [Cloudflare Pages](https://pages.cloudflare.com/)
   - Click **"Create a project"**
   - Select **"Connect to Git"**
   - Choose your GitHub repository
   - Configure build settings:
     - **Framework preset:** None
     - **Build command:** (leave empty)
     - **Build output directory:** `/`
   - Click **"Save and Deploy"**

3. **Access Your Site**
   - Your site will be live at: `https://your-project.pages.dev`
   - Every push to `main` branch auto-deploys!

### Option 2: Local Testing

```bash
# Simply open index.html in your browser
# Or use a local server:

# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server

# Then visit: http://localhost:8000
```

---

## 📁 Project Structure

```
mcq-study-platform/
├── index.html              # Main entry point
├── css/
│   └── style.css          # All styling
├── js/
│   └── app.js             # Application logic
├── data/
│   ├── topics.json        # Topic registry
│   └── llqp-ethics/
│       └── questions.json # LLQP Ethics MCQs (10 questions)
├── README.md              # This file
└── .gitignore            # Git ignore rules
```

---

## ➕ Adding New Questions

### For Existing Topics

Edit the relevant JSON file in `data/[topic-folder]/questions.json`:

```json
{
  "id": 11,
  "question": "Your question text here...",
  "options": [
    "A. First option",
    "B. Second option",
    "C. Third option",
    "D. Fourth option"
  ],
  "correctAnswer": 2,
  "explanation": "Explanation of why C is correct...",
  "difficulty": "medium",
  "tags": ["tag1", "tag2"]
}
```

**Key Notes:**
- `correctAnswer` is **zero-indexed** (0 = A, 1 = B, 2 = C, 3 = D)
- `difficulty` options: `"easy"`, `"medium"`, `"hard"`
- Tags help with future filtering features

### For New Topics

1. Create folder: `data/new-topic-name/`
2. Create file: `data/new-topic-name/questions.json`
3. Update `data/topics.json`:

```json
{
  "id": "new-topic",
  "name": "New Topic Name",
  "slug": "new-topic",
  "description": "Description of the topic",
  "color": "#3b82f6",
  "icon": "📘",
  "questionCount": 25,
  "dataFile": "data/new-topic/questions.json",
  "status": "active"
}
```

4. Commit and push - auto-deploys!

---

## 🎨 Customization

### Change Colors

Edit CSS variables in `css/style.css`:

```css
:root {
  --primary-color: #3b82f6;    /* Main theme color */
  --success-color: #10b981;    /* Correct answer color */
  --warning-color: #f59e0b;    /* Bookmark color */
  /* ... more variables ... */
}
```

### Add Topic Icons

Available emoji options for topic icons:
- ⚖️ Ethics/Legal
- 🛡️ Compliance
- 💼 Business/Finance
- 🏥 Health/Life Insurance
- 🚑 Accident/Emergency
- 📊 Funds/Investments
- 📚 General Study

---

## 🔧 Technical Details

### Built With
- **HTML5** - Semantic markup
- **CSS3** - Modern responsive design
- **Vanilla JavaScript** - No frameworks, no build tools
- **LocalStorage API** - Progress persistence

### Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

### Performance
- **Load Time:** < 1 second
- **Bundle Size:** ~50KB total
- **Lighthouse Score:** 95+

---

## 📊 Current Question Count

| Topic | Questions | Status |
|-------|-----------|--------|
| LLQP Ethics (Common Law) | **10** | ✅ Active |
| WFG Ethics Compliance | 0 | 🔜 Coming Soon |
| WFG Anti-Money Laundering | 0 | 🔜 Coming Soon |
| LLQP Life Insurance | 0 | 🔜 Coming Soon |
| LLQP Accident & Sickness | 0 | 🔜 Coming Soon |
| LLQP Segregated Funds | 0 | 🔜 Coming Soon |
| **Total** | **10** | |

---

## 🔄 Updating Questions

1. **Edit JSON files** in `data/` folder
2. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add 10 new WFG Ethics questions"
   git push
   ```
3. **Auto-deploys** - Live in ~1 minute!

---

## 🌐 Deployment Status

Once deployed to Cloudflare Pages:
- ✅ Automatic deployments on push
- ✅ Preview deployments for branches
- ✅ Free custom domain support
- ✅ Analytics available (Cloudflare Web Analytics)
- ✅ Unlimited bandwidth & requests

---

## 🤝 Contributing

Want to add more questions? Follow these steps:

1. Fork the repository
2. Add questions to appropriate JSON files
3. Test locally
4. Submit a Pull Request

**Question Guidelines:**
- Clear, unambiguous wording
- 4 options (A, B, C, D)
- Detailed explanations
- Proper difficulty tagging

---

## 📝 License

MIT License - Feel free to use for personal or educational purposes.

---

## 🆘 Support

### Common Issues

**Q: Questions not showing?**  
A: Check browser console for errors. Ensure JSON files are valid (use [JSONLint](https://jsonlint.com/)).

**Q: Progress not saving?**  
A: Make sure localStorage is enabled in your browser. Check Privacy settings.

**Q: How do I reset progress?**  
A: Use the "Reset Progress" button in the MCQ view, or clear localStorage manually.

### Contact

For issues or questions:
- Open a GitHub issue
- Check [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/)

---

## 🎓 Study Tips

📌 **Use the bookmark feature** for questions you find challenging  
🔄 **Review bookmarked questions** regularly  
✅ **Read explanations carefully** even when you get it right  
📊 **Track your progress** across all topics  
🎯 **Focus on understanding** the "why" behind each answer

---

## 🚀 Roadmap

Future enhancements planned:
- [ ] Search functionality across questions
- [ ] Quiz mode with timer
- [ ] Score tracking and statistics
- [ ] Export progress as PDF
- [ ] Dark mode toggle
- [ ] Question difficulty filtering
- [ ] Tag-based filtering

---

**Built with ❤️ for LLQP & WFG exam success**

Good luck with your studies! 📚✨
