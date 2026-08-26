import { registerRootComponent } from 'expo';

import App from './App';

// Titik masuk aplikasi. Sebelumnya package.json menunjuk langsung ke
// node_modules/expo/AppEntry.js -- pola lama yang sudah tidak dianjurkan
// sejak Expo memindahkan titik masuk ke berkas milik project sendiri.
registerRootComponent(App);
