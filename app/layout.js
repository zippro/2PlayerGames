import './globals.css';
import { TournamentProvider } from '@/lib/tournament';

export const metadata = {
  title: '2 Player Games — The Challenge',
  description: 'Play the best 2 player games on one device! Ping Pong, Tic Tac Toe, Sea Battle, Darts, Tennis and more. Challenge a friend or play against the bot!',
  keywords: '2 player games, two player, multiplayer, mini games, ping pong, tic tac toe, darts, tennis, archery',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3d4f5f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <script src="/ignis.js?v=8" defer />
        <TournamentProvider>
          <div className="app-container">
            {children}
          </div>
        </TournamentProvider>
      </body>
    </html>
  );
}
