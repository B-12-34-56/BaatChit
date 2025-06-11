# Baatchit - Realtime Private Chat Application

Baatchit is a real-time private chat web application built using React and Firebase. It provides users with a secure authentication, and seamless chatting experience where they can communicate with their friends in real-time.

### [Demo](https://baatchit-nb.vercel.app/)


## Features

- User authentication
- Private chat rooms
- Real-time updates of chat messages
- Sending text messages and images


## Technologies Used

- React
- Firebase Realtime Database
- Firebase Authentication
- Sass

## ScreenShots

<img width="959" alt="1" src="https://user-images.githubusercontent.com/103204431/226623828-9c12bb75-6b0b-4a7f-94de-aa9f6287eaa3.png">

<img width="959" alt="2" src="https://user-images.githubusercontent.com/103204431/226623775-41deccf1-0bfd-40c8-bfa0-ecfeb45966f1.png">

<img width="960" alt="3" src="https://user-images.githubusercontent.com/103204431/226623861-b9696b7f-c996-414e-924e-9bc12af130b1.png">

## 🚀 Setup

1. Clone the repo:
   ```bash
   git clone <repo-url>
   cd Baatchit
   ```
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Set up your `.env` file with Firebase credentials:
   ```env
   REACT_APP_FIREBASE_KEY=your_api_key
   # ...other Firebase env vars if needed
   ```
4. Start the app:
   ```bash
   npm start
   # or
   yarn start
   ```

## 🧪 Testing

Run tests with:
```bash
npm test
# or
yarn test
```

## 🧹 Linting & Formatting

- Lint: `npm run lint` or `yarn lint`
- Format: `npm run format` or `yarn format`

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Commit your changes
4. Open a pull request

## 🛣️ Roadmap
- [ ] Improve UI/UX
- [ ] Add group chat support
- [ ] Add notifications
- [ ] Enhance security rules

## 🔒 Security
- Review and update Firebase security rules regularly.
- **After editing Firestore or Realtime Database rules locally, you must publish them:**
  - In the Firebase Console: [https://console.firebase.google.com/](https://console.firebase.google.com/)
  - Or with the CLI: `firebase deploy --only firestore:rules database:rules`

## 📄 License
MIT
