// app/index.js - Updated version
import React from 'react';
import { db } from '../src/utils/firebase';
import App from './_layout';

// Ensure Firestore is initialized
console.log('Firestore initialized:', db);

export default function Index() {
  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}