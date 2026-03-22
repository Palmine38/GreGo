# TAG Express - Web Application

A modern web application for managing and searching transportation routes using the TAG (Transports de l'Agglomération Grenobloise) transit system.

## Features

- **Multi-trajectory Management**: Save and manage up to 3 different routes (T1, T2, T3) with persistent storage
- **Route Search**: Search for transportation routes with filters by departure, arrival, and line number
- **Persistent Storage**: All trajectories are automatically saved to browser's localStorage
- **Time Navigation**: Navigate between different time slots for the same route
- **Responsive Design**: Works seamlessly on mobile and desktop devices
- **Real-time Data**: Integrates with TAG's API for live route information
- **Quick Search**: Fast search functionality for one-off route queries

## Technology Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **HTTP Client**: Fetch API
- **Data Source**: TAG Mobilités API (data.mobilites-m.fr)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Palmine38/Web-TAG-express.git
cd Web-TAG-express
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── mestrajets.jsx      # Main component for multi-trajectory management
│   ├── testhome.jsx        # Quick search page
│   └── navbar.jsx          # Navigation bar
├── App.jsx                 # Main app component
├── App.css                 # Global styles
└── main.jsx               # Entry point
```

## Key Components

### Mes Trajets (My Routes)
- Manage up to 3 saved routes
- View and modify route details (departure, arrival, line)
- Auto-save functionality with visual feedback
- Persistent storage across sessions

### Recherche Rapide (Quick Search)
- One-time route search without saving
- Same search capabilities as the saved routes
- Quick results display

### Navbar
- Navigation between pages
- Hamburger menu for mobile
- Responsive design

## API Integration

The application uses the TAG Mobilités open API:
- **Base URL**: `https://data.mobilites-m.fr/api/routers/default`
- Fetches available routes, stops, and itineraries
- Real-time transportation data

## Features in Detail

### Route Saving
- Save departure, arrival, and line preferences
- Auto-restore on page reload
- Color-coded buttons indicate saved vs unsaved routes

### Search Filtering
- Filter by specific line number
- Supports multiple line formats (E, A, C1, etc.)
- Results limited to routes under 35 minutes
- Time offset navigation for different time slots

### State Management
- React hooks for state management
- localStorage for persistence
- Separate cache for search results per trajectory

## Browser Compatibility

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is open source and available under the MIT License.

## Author

Created by [Palmine38](https://github.com/Palmine38)

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.
