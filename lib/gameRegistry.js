// Game Registry — Central metadata for all games
export const GAMES = [
  {
    id: 'ping-pong',
    name: 'Ping Pong',
    colors: ['#F59E0B', '#10B981'],
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #10B981 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'Classic table tennis! Move your paddle to hit the ball past your opponent.',
    howToPlay: [
      'Each player controls a paddle on their side of the screen.',
      'Use touch/drag or arrow keys to move your paddle up and down.',
      'Hit the ball past your opponent to score. First to 7 wins!',
    ],
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    colors: ['#8B5CF6', '#EC4899'],
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'The classic X and O game! Get three in a row to win.',
    howToPlay: [
      'Players take turns placing their mark (X or O) on the 3x3 grid.',
      'Get three of your marks in a row — horizontally, vertically, or diagonally.',
      'Block your opponent while trying to complete your own line!',
    ],
  },
  {
    id: 'sea-battle',
    name: 'Sea Battle',
    colors: ['#06B6D4', '#3B82F6'],
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'Place your ships and hunt down your opponent\'s fleet!',
    howToPlay: [
      'Place your ships on your grid. Tap to place, long press to rotate.',
      'Take turns firing at your opponent\'s grid to find their ships.',
      'Sink all enemy ships to win! Red = hit, White = miss.',
    ],
  },
  {
    id: 'memory-match',
    name: 'Find Match',
    colors: ['#EF4444', '#06B6D4'],
    gradient: 'linear-gradient(135deg, #EF4444 0%, #06B6D4 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'Flip cards and find matching pairs. Who has the better memory?',
    howToPlay: [
      'Tap a card to flip it over and reveal the symbol underneath.',
      'Flip two cards per turn. If they match, you keep them and go again!',
      'The player who finds the most pairs wins!',
    ],
  },
  {
    id: 'knife-throw',
    name: 'Knife Throw',
    colors: ['#1E3A5F', '#F59E0B'],
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #F59E0B 100%)',
    modes: ['2p', '1p'],
    badge: 'NEW',
    description: 'Throw knives at the spinning target! Don\'t hit other knives!',
    howToPlay: [
      'Tap the screen to throw your knife at the rotating target.',
      'Be careful not to hit a knife that\'s already stuck in the target!',
      'Players take turns. Miss or hit a knife and you lose!',
    ],
  },
  {
    id: 'spin-war',
    name: 'Spin War',
    colors: ['#7C3AED', '#F97316'],
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #F97316 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'Tap as fast as you can to spin your spinner! Highest RPM wins!',
    howToPlay: [
      'Tap your side of the screen rapidly to spin your spinner faster.',
      'Both players spin at the same time for 5 seconds.',
      'The spinner with the higher speed wins the round!',
    ],
  },
  {
    id: 'soccer-pool',
    name: 'Soccer Pool',
    colors: ['#10B981', '#FBBF24'],
    gradient: 'linear-gradient(135deg, #10B981 0%, #FBBF24 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'Flick soccer balls into the goal! A mix of pool and football.',
    howToPlay: [
      'Drag on your ball to aim, then release to kick it.',
      'Score by getting the ball into the opponent\'s goal.',
      'Use bank shots and strategy to outplay your opponent!',
    ],
  },
  {
    id: 'backgammon',
    name: 'Backgammon',
    colors: ['#92400E', '#D97706'],
    gradient: 'linear-gradient(135deg, #92400E 0%, #D97706 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'The ancient board game of strategy and luck!',
    howToPlay: [
      'Roll the dice and move your pieces around the board.',
      'Move all your pieces to your home board, then bear them off.',
      'Land on your opponent\'s single pieces to send them back!',
    ],
  },
  {
    id: 'darts',
    name: 'Darts',
    colors: ['#1E3A5F', '#27ae60'],
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #27ae60 100%)',
    modes: ['2p', '1p'],
    badge: 'NEW',
    description: 'Throw darts at the board! Aim for the bullseye!',
    howToPlay: [
      'A crosshair moves across the dartboard automatically.',
      'Tap to throw your dart where the crosshair is pointing.',
      'Score points based on where you hit. 3 darts per round, 3 rounds total.',
    ],
  },
  {
    id: 'slot-cars',
    name: 'Slot Cars',
    colors: ['#1a1a2e', '#e74c3c'],
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #e74c3c 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'Race around the track! Hold to accelerate, first to 3 laps wins!',
    howToPlay: [
      'Hold your side of the screen to accelerate your car.',
      'Cars follow the track automatically — you control the speed!',
      'Complete 3 laps first to win the race!',
    ],
  },
  {
    id: 'archery',
    name: 'Archery',
    colors: ['#228B22', '#87CEEB'],
    gradient: 'linear-gradient(135deg, #228B22 0%, #87CEEB 100%)',
    modes: ['2p', '1p'],
    badge: 'NEW',
    description: 'Draw your bow and hit the bullseye! Set power then aim.',
    howToPlay: [
      'First tap sets your power — watch the power bar!',
      'Second tap sets your aim — the bow sways up and down.',
      'Score points based on accuracy. 5 rounds, highest total wins!',
    ],
  },
  {
    id: 'tennis',
    name: 'Tennis',
    colors: ['#2d5a27', '#AAFF00'],
    gradient: 'linear-gradient(135deg, #2d5a27 0%, #AAFF00 100%)',
    modes: ['2p', '1p'],
    badge: null,
    description: 'Fast-paced tennis action! Serve, rally, and score!',
    howToPlay: [
      'Move your racket by dragging on your side of the court.',
      'Tap to serve the ball. Hit it past your opponent!',
      'First to 5 points wins the match!',
    ],
  },
];

export function getGameById(id) {
  return GAMES.find(g => g.id === id);
}

export function getGamesByMode(mode) {
  return GAMES.filter(g => g.modes.includes(mode));
}

// Difficulty levels
export const DIFFICULTY = {
  EASY: { id: 'easy', label: 'Easy', value: 0 },
  NORMAL: { id: 'normal', label: 'Normal', value: 1 },
  HARD: { id: 'hard', label: 'Hard', value: 2 },
};

export function getDifficultyByValue(val) {
  if (val <= 0.33) return DIFFICULTY.EASY;
  if (val <= 0.66) return DIFFICULTY.NORMAL;
  return DIFFICULTY.HARD;
}
