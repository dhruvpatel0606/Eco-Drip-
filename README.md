# 🌿 Eco-Drip — Smart IoT Irrigation System

[![Author](https://img.shields.io/badge/Developed%20By-DHRUV%20PATEL-0d9488?style=for-the-badge&logo=github)](https://github.com/dhruvjpatel0101-cloud)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)

**Eco-Drip** is an IoT-based smart irrigation system designed and built by **DHRUV PATEL**. It automates plant watering using real-time soil moisture, temperature, and humidity data collected from Arduino UNO R4 WiFi sensors, synchronized with a Supabase backend and an AI-powered advisory engine to optimize watering schedules, reduce water wastage, and support healthier plant growth.

---

## ✨ Features

- 📊 **Real-time Dashboard** — Live soil moisture, temperature, and humidity monitoring
- 🤖 **AI Plant Advisor** — Intelligent plant health diagnostics and watering recommendations
- 📅 **Smart Scheduling** — Weather-aware automated irrigation planning
- 🗺️ **Eco Map** — Geographic plant and device tracking
- 👥 **Community** — Share tips and progress with other growers
- 📱 **Mobile App** — Android APK built with Capacitor
- 🔔 **Push Notifications** — Watering alerts and system events
- 🌍 **PWA Support** — Installable on any device

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, Supabase |
| Mobile | Capacitor (Android) |
| Hardware | Arduino UNO R4 WiFi |
| Database | Supabase (PostgreSQL) |
| AI Engine | Custom multi-model advisory system |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An AI API key (configure in `.env`)

### Installation

```bash
# Clone the repository
git clone https://github.com/dhruvjpatel0101-cloud/Eco-Drip.git
cd Eco-Drip

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start the development server
npm run dev
```

---

## 📂 Project Structure

```
Eco-Drip/
├── src/lib/          # Core services (AI, Supabase, weather)
├── components/       # React UI components
├── public/           # Static assets & PWA manifest
├── android/          # Capacitor Android project
└── server.ts         # Express backend server
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

**Designed & Built by DHRUV PATEL**
