# 🚀 Gravatar Account Creator

An automated tool for creating multiple Gravatar accounts using Puppeteer and Mailcow integration.

![Gravatar Logo](https://cdn.iconscout.com/icon/free/png-256/free-gravatar-logo-icon-download-in-svg-png-gif-file-formats--technology-social-media-company-vol-3-pack-logos-icons-3032401.png)

## ✨ Features

- 🔄 **Automated Account Creation**: Creates Gravatar accounts automatically
- 📧 **Email Integration**: Uses Mailcow for temporary email creation
- 🔐 **OTP Handling**: Automatically retrieves verification codes from email
- 🎯 **Batch Processing**: Create multiple accounts in one run
- 💾 **Account Storage**: Saves all created account details to file
- 🎨 **Beautiful Console Output**: Colored terminal output with progress tracking
- 🌐 **Browser Automation**: Visual browser automation with Puppeteer

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Mailcow server with API access
- Valid Mailcow domain

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tigrilminnada/gravatar-account-creator.git
   cd gravatar-account-creator
   ```

2. **Install dependencies**
   ```bash
   npm install puppeteer @faker-js/faker axios node-imap mailparser readline chalk dotenv
   ```

3. **Create `.env` file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   ```env
   MAILCOW_SERVER=your-mailcow-server.com
   MAILCOW_API_KEY=your-api-key-here
   MAILCOW_DOMAIN=yourdomain.com
   DEFAULT_PASSWORD=your-default-password
   ```

## 🚀 Usage

1. **Run the application**
   ```bash
   node tes.js
   ```

2. **Enter the number of accounts** you want to create when prompted

3. **Watch the automation** as it:
   - Creates temporary email addresses
   - Navigates to Gravatar signup
   - Fills registration forms
   - Retrieves verification codes
   - Completes account setup

## 📁 Project Structure

```
├── tes.js                 # Main application file
├── .env                  # Configuration file (create this)
├── .env.example          # Environment template
├── gravatar_accounts.txt # Generated accounts (auto-created)
├── package.json          # Dependencies
└── README.md            # This file
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MAILCOW_SERVER` | Your Mailcow server domain | `mail.example.com` |
| `MAILCOW_API_KEY` | API key for Mailcow | `your-api-key-here` |
| `MAILCOW_DOMAIN` | Domain for email creation | `example.com` |
| `DEFAULT_PASSWORD` | Default password for mailboxes | `SecurePass123!` |

### Browser Settings

The application uses these browser settings:
- **Window Size**: 600x700 pixels
- **Position**: (100, 50)
- **Headless**: False (visible browser)
- **Slow Motion**: 50ms delays

## 📝 Output

Created accounts are saved to `gravatar_accounts.txt` with this format:

```
Date: 2025-06-09T10:30:45.123Z
Email: johnsmith123@yourdomain.com
Password: SecurePass123!
Name: John Smith
-----------------------------------
```

## 🔧 Troubleshooting

### Common Issues

1. **"Cannot find module" error**
   ```bash
   npm install
   ```

2. **IMAP connection failed**
   - Check Mailcow server settings
   - Verify API key permissions
   - Ensure port 993 is accessible

3. **Browser automation fails**
   - Update Puppeteer: `npm update puppeteer`
   - Check for Chrome/Chromium installation

4. **OTP retrieval timeout**
   - Verify email delivery to Mailcow
   - Check spam/junk folders
   - Increase timeout values in code

### Debug Mode

To enable verbose logging, modify the code:
```javascript
const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,  // Increase for slower execution
    devtools: true // Opens DevTools
});
```

## 📊 Performance

- **Average time per account**: 2-3 minutes
- **Success rate**: ~95% (depends on network/server)
- **Concurrent limit**: 1 (sequential processing)

## 🛡️ Security Considerations

- Store API keys securely in `.env` file
- Use strong passwords for mailboxes
- Regularly rotate API keys
- Monitor Mailcow server logs
- Don't commit `.env` file to version control

## 📚 Dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer` | Browser automation |
| `@faker-js/faker` | Generate fake user data |
| `axios` | HTTP requests to Mailcow API |
| `node-imap` | Email retrieval |
| `mailparser` | Parse email content |
| `chalk` | Colored console output |
| `dotenv` | Environment variable loading |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for educational and legitimate purposes only. Users are responsible for:
- Complying with Gravatar's Terms of Service
- Using reasonable rate limits
- Not creating accounts for spam or malicious purposes
- Respecting server resources

## 👨‍💻 Author

**Masanto**

- GitHub: [@tigrilminnada](https://github.com/tigrilminnada)
- Facebook: [Mas Santo](https://facebook.com/scht.id)
- Tiktok: [@masanto_id](https://tiktok.com/@masanto_id)

## 🙏 Acknowledgments

- Puppeteer team for browser automation
- Faker.js for test data generation
- Mailcow team for email server solution

---

⭐ **Star this repository if it helped you!**

*Last updated: June 9, 2025*
