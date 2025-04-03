type StartScreenProps = {
  onStart: () => void;
  onLoad: () => void;
};

export default function StartScreen({ onStart, onLoad }: StartScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <h1 className="text-4xl font-bold text-white">Hunter Game</h1>
      <p className="text-xl text-white/80 text-center max-w-md">
        Embark on a text-based adventure where your choices shape the story.
      </p>
      <div className="flex gap-4">
        <button
          onClick={onStart}
          className="px-6 py-3 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200"
        >
          Start New Journey
        </button>
        <button
          onClick={onLoad}
          className="px-6 py-3 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200"
        >
          Load Journey
        </button>
      </div>
    </div>
  );
} 