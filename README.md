# IronTrain

IronTrain is a premium, offline-first gym tracking application built with **React Native**, **Expo**, and **SQLite**. Designed with the "IronTrain Industrial" aesthetic, it focuses on efficiency, performance, and data ownership.

![IronTrain Banner](https://via.placeholder.com/800x200.png?text=IronTrain+Industrial)

## 🚀 Features

-   **Daily Workout Log**: Automatic workout creation based on selected dates.
-   **Smart Sets**: "Ghost Values" pre-fill your sets with data from your last successful session of that exercise.
-   **Exercise Database**: Manage your library with custom exercises, categories, and search.
-   **Analytics Engine**:
    -   Visualize Volume trends (Last 7 workouts).
    -   Consistency Heatmap (Last 30 days).
    -   Estimated 1RM calculations.
-   **Tools**: Plate Calculator and Database Backup/Export.
-   **Offline First**: All data is stored locally in `irontrain_v1.db`.

## 🛠 Tech Stack

-   **Framework**: [Expo](https://expo.dev/) (React Native) via `expo-router`.
-   **Database**: `expo-sqlite` (High-performance local SQL).
-   **Styling**: `nativewind` (TailwindCSS for React Native).
-   **Lists**: `@shopify/flash-list` (recycling views for speed).
-   **Charts**: `react-native-gifted-charts`.

## 📂 Project Structure

```
IronTrain/
├── app/                  # Expo Router screens
│   ├── (tabs)/           # Main Tabs: Index (Log), Library, Analysis
│   ├── _layout.tsx       # Root layout & Theme provider
│   └── ...
├── components/           # Reusable UI components
│   ├── WorkoutLog.tsx    # The core logging interface
│   ├── SetRow.tsx        # Individual set interaction
│   └── ...
├── src/
│   ├── services/         # Business Logic & DB Access
│   │   ├── DatabaseService.ts # SQL Schema & Raw Queries
│   │   ├── WorkoutService.ts  # Domain Logic
│   │   └── ...
│   └── types/            # TypeScript Interfaces
└── assets/               # Icons and Fonts
```

## 🏗 Building the APK

This project is configured for **EAS Build** (Expo Application Services).

### Prerequisites
-   Expo Account (Free)
-   EAS CLI installed: `npm install -g eas-cli`

### Generate APK (Android)
To build a side-loadable APK (installation file) for Android devices:

```bash
eas build -p android --profile preview
```

1.  Select **Yes** when asked to generate a Keystore.
2.  Wait for the build to finish in the cloud.
3.  Download the `.apk` link provided at the end.

## 🏃 Running Locally

```bash
# Install dependencies
npm install

# Start Metro Bundler
npx expo start
```

-   Press `a` to run on Android Emulator / Connected Device.
-   Press `i` to run on iOS Simulator.
