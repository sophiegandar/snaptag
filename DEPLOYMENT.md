# 🚀 SnapTag Deployment Guide

## Option 1: Railway.app (RECOMMENDED - $5/month)

### 1. Prerequisites
- GitHub account with SnapTag repository
- Railway.app account (free signup)

### 2. Deploy Steps

1. **Push to GitHub** (if not already done)
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Deploy on Railway**
- Go to [railway.app](https://railway.app)
- Click "Deploy from GitHub repo"
- Select your SnapTag repository
- Railway will auto-detect and build!

3. **Set Environment Variables**
In Railway dashboard, add these variables:
```
NODE_ENV=production
PORT=3001
DROPBOX_ACCESS_TOKEN=your_token_here
DROPBOX_REFRESH_TOKEN=your_refresh_token_here  
DROPBOX_APP_KEY=your_app_key_here
DROPBOX_APP_SECRET=your_app_secret_here
DROPBOX_FOLDER=/ARCHIER Team Folder/Support/Production/SnapTag
```

4. **Add Custom Domain** (optional)
- In Railway dashboard: Settings → Domains
- Add your custom domain (e.g., snaptag.archier.com.au)

### 3. Update Chrome Extension
Update the server URL in `extension/background.js`:
```javascript
const serverUrl = 'https://your-app.railway.app'; // Replace with your Railway URL
```

---

## Option 2: Render.com ($7/month)

### 1. Deploy Steps
1. Connect GitHub to Render.com
2. Create new "Web Service"
3. Build Command: `npm run build`
4. Start Command: `npm start`

### 2. Environment Variables
Same as Railway (see above)

### 3. Persistent Storage
- Enable "Persistent Disk" in Render dashboard
- Mount path: `/app/server/data`

---

## Option 3: Self-Hosted (VPS)

### Quick VPS Setup
```bash
# On any Ubuntu/Debian VPS
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Clone and run
git clone https://github.com/your-username/snaptag.git
cd snaptag
cp .env.example .env
# Edit .env with your Dropbox credentials
docker-compose up -d
```

---

## 🔧 Post-Deployment Checklist

### ✅ Test Web App
- Visit your deployed URL
- Upload an image
- Check advanced search
- Test professional workflow analysis

### ✅ Test Chrome Extension  
- Right-click save an image
- Verify it appears in web app
- Check Dropbox folder

### ✅ Monitor Performance
- Check logs in platform dashboard
- Verify database persistence
- Test backup/restore

---

## 💾 Backup Strategy

### Database Backup
```bash
# Download database file from platform
# Railway: Use Railway CLI or dashboard file browser
# Render: Access via SSH and download /app/server/data/snaptag.db
```

### Dropbox Integration
- All images automatically backed up to Dropbox
- Metadata embedded in image files
- Can rebuild database from Dropbox if needed

---

## 🔒 Security Considerations

### Production Checklist
- ✅ HTTPS enabled (automatic on Railway/Render)
- ✅ Environment variables secured
- ✅ Rate limiting enabled
- ✅ CORS configured for your domain
- ✅ Database file permissions restricted

### Team Access
- Share the deployed URL with team
- Update Chrome extension on each browser
- Set up custom domain for professional appearance

---

## 🚨 Troubleshooting

### Common Issues
1. **Build fails**: Check Node.js version (need 18+)
2. **Dropbox errors**: Verify environment variables
3. **Extension not connecting**: Update server URL in background.js
4. **Database issues**: Check persistent storage configuration

### Platform-Specific Help
- **Railway**: Check build logs in dashboard
- **Render**: Use shell access for debugging
- **Self-hosted**: Check Docker logs with `docker-compose logs`

---

## 📊 Cost Comparison

| Platform | Monthly Cost | Setup Time | Maintenance |
|----------|-------------|------------|-------------|
| Railway  | $5-10       | 5 minutes  | Zero        |
| Render   | $7-15       | 10 minutes | Minimal     |  
| VPS      | $5-20       | 30 minutes | Medium      |
| Digital Ocean | $10-25  | 60 minutes | High        |

**Recommendation: Start with Railway.app for simplicity and cost.** 